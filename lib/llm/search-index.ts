import "server-only";
import { sql, type Transaction } from "kysely";
import { z } from "zod/v4";
import { db } from "../../db/db";
import { discoverVector, physicalVector } from "../../db/vector";
import { contentTransaction } from "../../db/content-transaction";
import { locks, lock } from "../../db/locks";
import type { DB } from "../../db/schema";
import { validCosineVector } from "../vector-values";
import { getConfig } from "../config";
import { DomainError } from "../domain-error";
import { requireAdmin, type Actor } from "../auth/authorization";
import { runtimeState } from "../runtime-state";
import { requireLease, type Lease } from "../jobs/leases";
import {
  advanceIndexGeneration,
  lockedIndexSettings,
  matchesIndexGeneration,
  invalidateConfiguration,
} from "./settings-store";
import { supportsEmbeddingModel } from "./model-profiles";
import { AiError } from "./errors";

const fingerprintSchema = z.object({
  model: z.string(),
  dimensions: z.number().int().min(1).max(4000),
  generation: z.string().regex(/^[1-9][0-9]*$/),
});
export type IndexRow = {
  kind: "post" | "comment";
  id: string;
  revision: string;
  text: string;
};
function describe({
  config,
  epoch,
  storedFingerprint,
  physical,
}: Awaited<ReturnType<typeof lockedIndexSettings>>) {
  const fingerprint = fingerprintSchema.safeParse(storedFingerprint).data;
  let reason: string | null = null;
  if (config.diverged) reason = "CONFIGURATION_DIVERGED";
  else if (
    !config.valid ||
    !config.configured ||
    !config.apiKey ||
    config.options.embeddingModel === "none"
  )
    reason = "off";
  else if (!physical) reason = "column-mismatch";
  else if (physical.indexesValid === false) reason = "rebuild-required";
  else if (!supportsEmbeddingModel(config.options.embeddingModel))
    reason = "UNSUPPORTED_EMBEDDING_TOKENIZER";
  else if (
    config.widthMismatch ||
    (storedFingerprint &&
      (!fingerprint ||
        fingerprint.model !== config.options.embeddingModel ||
        fingerprint.dimensions !== physical.dimensions))
  )
    reason = "rebuild-required";
  return { config, epoch, fingerprint, physical, reason };
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
    const settings = await lockedIndexSettings(trx, create);
    const { physical } = settings;
    const snapshot = describe(settings);
    if (!create || snapshot.reason || settings.storedFingerprint || !physical)
      return snapshot;
    const fingerprint = {
      model: snapshot.config.options.embeddingModel,
      dimensions: physical.dimensions,
      generation: "1",
    };
    return describe(
      await advanceIndexGeneration(
        trx,
        fingerprint,
        physical,
        snapshot.config,
        true,
      ),
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
  if (
    !(await matchesIndexGeneration(trx, index.epoch, {
      token: index.config.token,
      fingerprint: index.fingerprint,
    }))
  )
    throw new AiError("STALE_CONFIGURATION");
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
    const before = describe(await lockedIndexSettings(trx, true));
    const { physical } = before;
    if (
      expected.epoch !== before.epoch ||
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
    const metadata = physical ?? (await discoverVector(trx, n));
    const [major, minor] = metadata.version.split(".").map(Number);
    if (n > 2000 && major === 0 && minor < 7)
      throw new DomainError("BAD_REQUEST", "HALFVEC_UNAVAILABLE");
    const kind = n > 2000 ? "halfvec" : "vector";
    for (const table of ["feedback", "comment"] as const) {
      await sql`drop index if exists ${sql.id(table + "_embedding_idx")}`.execute(
        trx,
      );
      if (!physical || n !== physical.dimensions) {
        await sql`alter table ${sql.table(table)} alter column embedding type ${sql.id(metadata.schema, kind)}(${sql.lit(n)}) using null`.execute(
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
      await sql`create index ${sql.id(table + "_embedding_idx")} on ${sql.table(table)} using hnsw(embedding ${sql.id(metadata.schema, kind + "_cosine_ops")})`.execute(
        trx,
      );
    }
    const verified = await physicalVector(trx);
    if (!verified?.indexesValid || verified.dimensions !== n)
      throw new DomainError(
        "PRECONDITION_FAILED",
        "INDEX_COLUMNS_INCONSISTENT",
      );
    const fingerprint = {
      model,
      dimensions: n,
      generation: (
        BigInt(before.fingerprint?.generation ?? "0") + 1n
      ).toString(),
    };
    const updated = await advanceIndexGeneration(
      trx,
      fingerprint,
      verified,
      before.config,
    );
    await requireAdmin(trx, actor);
    return describe(updated);
  });
  publish(snapshot);
  return {
    epoch: snapshot.epoch,
    dimensions: n,
    identity: {
      token: snapshot.config.token,
      revision: snapshot.config.revision,
    },
    configured: snapshot.config.configured,
  };
}
