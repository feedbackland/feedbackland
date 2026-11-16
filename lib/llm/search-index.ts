import "server-only";
import { sql, type Selectable, type Transaction } from "kysely";
import { z } from "zod/v4";
import { db } from "../../db/db";
import { contentTransaction } from "../../db/content-transaction";
import { physicalVector } from "../../db/vector";
import { locks, lock } from "../../db/locks";
import type { DB, AiSettings } from "../../db/schema";
import { validCosineVector } from "../vector-values";
import { getConfig } from "../config";
import { DomainError } from "../domain-error";
import { requireAdmin, type Actor } from "../auth/authorization";
import { runtimeState, type VectorMetadata } from "../runtime-state";
import { requireLease, type Lease } from "../jobs/leases";
import {
  configurationForRow,
  invalidateConfiguration,
  replaceIndexToken,
} from "./settings-store";
import { supportsEmbeddingModel } from "./model-profiles";
import { AiError } from "./errors";

const fingerprintSchema = z.object({
  model: z.string(),
  dimensions: z.number().int().min(1).max(4000),
  generation: z.string().regex(/^[1-9][0-9]*$/),
});
export type Fingerprint = z.infer<typeof fingerprintSchema>;
export type IndexRow = {
  kind: "post" | "comment";
  id: string;
  revision: string;
  text: string;
};
type Settings = Selectable<AiSettings>;
function describe(row: Settings, physical: VectorMetadata | null) {
  const config = configurationForRow(
    row,
    getConfig().authSecret,
    physical?.dimensions,
  );
  const fingerprint = fingerprintSchema.safeParse(row.indexFingerprint).data;
  let reason: string | null = null;
  if (
    !config.valid ||
    config.diverged ||
    !config.configured ||
    !config.apiKey ||
    config.options.embeddingModel === "none"
  )
    reason = "off";
  else if (!physical) reason = "column-mismatch";
  else if (!supportsEmbeddingModel(config.options.embeddingModel))
    reason = "UNSUPPORTED_EMBEDDING_TOKENIZER";
  else if (
    config.widthMismatch ||
    (row.indexFingerprint &&
      (!fingerprint ||
        fingerprint.model !== config.options.embeddingModel ||
        fingerprint.dimensions !== physical.dimensions))
  )
    reason = "rebuild-required";
  return { config, epoch: row.indexEpoch, fingerprint, physical, reason };
}
export type IndexSnapshot = ReturnType<typeof describe>;
function publish(snapshot: IndexSnapshot) {
  const state = runtimeState();
  if (state.vectorEpoch && BigInt(snapshot.epoch) < BigInt(state.vectorEpoch))
    return;
  if (
    state.vectorEpoch !== snapshot.epoch ||
    state.vector?.dimensions !== snapshot.physical?.dimensions
  ) {
    state.vectorEpoch = snapshot.epoch;
    if (snapshot.physical) state.vector = snapshot.physical;
    delete state.embeddingProbe;
    invalidateConfiguration();
  }
}
async function readIndex(create: boolean, signal?: AbortSignal) {
  return contentTransaction(signal, async (trx) => {
    const query = trx.selectFrom("ai_settings").selectAll().where("id", "=", 1);
    const row = await (
      create ? query.forUpdate() : query.forShare()
    ).executeTakeFirstOrThrow();
    const physical = await physicalVector(trx);
    const snapshot = describe(row, physical);
    if (!create || snapshot.reason || row.indexFingerprint || !physical)
      return snapshot;
    const fingerprint = {
      model: snapshot.config.options.embeddingModel,
      dimensions: physical.dimensions,
      generation: "1",
    };
    const updated = await trx
      .updateTable("ai_settings")
      .set({ indexEpoch: sql`"indexEpoch"+1`, indexFingerprint: fingerprint })
      .where("id", "=", 1)
      .returningAll()
      .executeTakeFirstOrThrow();
    const identity = await replaceIndexToken(
      trx,
      updated,
      undefined,
      getConfig().authSecret,
      physical.dimensions,
    );
    return describe(
      { ...updated, effectiveConfigToken: identity.token, lastCheck: null },
      physical,
    );
  });
}
export async function indexSnapshot(initialize = false, signal?: AbortSignal) {
  let snap = await readIndex(false, signal);
  if (initialize && !snap.reason && !snap.fingerprint)
    snap = await readIndex(true, signal);
  publish(snap);
  return snap;
}
export async function guardIndex(trx: Transaction<DB>, index: IndexSnapshot) {
  if (!index.fingerprint || !index.physical || index.reason)
    throw new AiError("STALE_CONFIGURATION");
  const row = await trx
    .selectFrom("ai_settings")
    .select("id")
    .where("id", "=", 1)
    .where("effectiveConfigToken", "=", index.config.token)
    .where("indexEpoch", "=", index.epoch)
    .where(
      sql<boolean>`"indexFingerprint"=${JSON.stringify(index.fingerprint)}::jsonb`,
    )
    .forShare()
    .executeTakeFirst();
  if (!row) throw new AiError("STALE_CONFIGURATION");
}
export async function writeVectors(
  index: IndexSnapshot,
  rows: IndexRow[],
  vectors: readonly (number[] | null)[],
  signal?: AbortSignal,
  lease?: Lease,
) {
  if (rows.length !== vectors.length || !index.physical)
    throw new AiError("invalid-response");
  const metadata = index.physical;
  if (vectors.some((v) => v && !validCosineVector(v, metadata.dimensions)))
    throw new AiError("invalid-response");
  return contentTransaction(signal, async (trx) => {
    if (lease) await requireLease(trx, lease);
    await guardIndex(trx, index);
    let written = 0;
    for (const [i, row] of rows.entries()) {
      const v = vectors[i];
      const result = await trx
        .updateTable(row.kind === "post" ? "feedback" : "comment")
        .where("id", "=", row.id)
        .where("revision", "=", row.revision)
        .where("embedding", "is", null)
        .where("embeddingSkipped", "=", false)
        .set(
          v
            ? {
                embedding: sql<string>`${JSON.stringify(v)}::${sql.id(metadata.schema, metadata.kind)}`,
              }
            : { embeddingSkipped: true },
        )
        .executeTakeFirst();
      written += Number(result.numUpdatedRows);
    }
    if (lease) await requireLease(trx, lease);
    return written;
  });
}
export async function indexCounts() {
  const { rows } = await sql<{
    total: number;
    pending: number;
    skipped: number;
  }>`select count(*)::int total,
    count(*) filter(where pending)::int pending,count(*) filter(where skipped)::int skipped from (
    select embedding is null and not "embeddingSkipped" as pending,"embeddingSkipped" as skipped from feedback
    union all select embedding is null and not "embeddingSkipped","embeddingSkipped" from comment) items`.execute(
    db,
  );
  return rows[0];
}
export async function rebuildIndex(
  actor: Actor,
  expected: { epoch: string; token: string; dimensions: number },
) {
  const env = getConfig();
  const n = expected.dimensions;
  if (
    !Number.isInteger(n) ||
    n < 1 ||
    n > 4000 ||
    (env.explicitDimensions && n !== env.dimensions)
  )
    throw new DomainError("BAD_REQUEST", "INVALID_INDEX_WIDTH");
  const snapshot = await db.transaction().execute(async (trx) => {
    await sql`set local lock_timeout='5s'`.execute(trx);
    await sql`set local statement_timeout='120s'`.execute(trx);
    await lock(trx, locks.membership);
    await requireAdmin(trx, actor, true);
    const row = await trx
      .selectFrom("ai_settings")
      .selectAll()
      .where("id", "=", 1)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const physical = await physicalVector(trx),
      before = describe(row, physical);
    if (!physical)
      throw new DomainError(
        "PRECONDITION_FAILED",
        "INDEX_COLUMNS_INCONSISTENT",
      );
    if (
      expected.epoch !== row.indexEpoch ||
      expected.token !== before.config.token ||
      before.config.diverged
    )
      throw new DomainError("CONFLICT", "INDEX_CHANGED");
    const model = before.config.options.embeddingModel;
    if (!supportsEmbeddingModel(model))
      throw new DomainError(
        "PRECONDITION_FAILED",
        "UNSUPPORTED_EMBEDDING_TOKENIZER",
      );
    const [major, minor] = physical.version.split(".").map(Number);
    if (n > 2000 && major === 0 && minor < 7)
      throw new DomainError("BAD_REQUEST", "HALFVEC_UNAVAILABLE");
    const kind = n > 2000 ? "halfvec" : "vector";
    for (const table of ["feedback", "comment"] as const) {
      if (n !== physical.dimensions) {
        await sql`drop index ${sql.id(table + "_embedding_idx")}`.execute(trx);
        await sql`alter table ${sql.table(table)} alter column embedding type ${sql.id(physical.schema, kind)}(${sql.lit(n)}) using null`.execute(
          trx,
        );
        await sql`create index ${sql.id(table + "_embedding_idx")} on ${sql.table(table)} using hnsw(embedding ${sql.id(physical.schema, kind + "_cosine_ops")})`.execute(
          trx,
        );
      }
      await trx
        .updateTable(table)
        .set({ embedding: null, embeddingSkipped: false })
        .where((eb) =>
          eb.or([
            eb("embedding", "is not", null),
            eb("embeddingSkipped", "=", true),
          ]),
        )
        .execute();
    }
    const fingerprint = {
      model,
      dimensions: n,
      generation: (
        BigInt(before.fingerprint?.generation ?? "0") + 1n
      ).toString(),
    };
    const next = await trx
      .updateTable("ai_settings")
      .set({ indexEpoch: sql`"indexEpoch"+1`, indexFingerprint: fingerprint })
      .where("id", "=", 1)
      .returningAll()
      .executeTakeFirstOrThrow();
    const identity = await replaceIndexToken(
      trx,
      next,
      undefined,
      env.authSecret,
      n,
    );
    await requireAdmin(trx, actor);
    return describe(
      { ...next, effectiveConfigToken: identity.token, lastCheck: null },
      { ...physical, kind, dimensions: n },
    );
  });
  publish(snapshot);
  return { epoch: snapshot.epoch, dimensions: n };
}
