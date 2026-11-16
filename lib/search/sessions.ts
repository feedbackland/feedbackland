import "server-only";
import { createHash } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import { canonicalSearchText } from "./text";
import { searchExpiry } from "./capability";
import { lock, locks } from "../../db/locks";
import type { DB } from "../../db/schema";
import { contentTransaction } from "../../db/content-transaction";
import { DomainError } from "../domain-error";
import { validateDatabaseText } from "../utils-server";
import { requireAdmin, type Actor } from "../auth/authorization";
import {
  indexSnapshot,
  guardIndex,
  type IndexSnapshot,
} from "../llm/search-index";
import { usableIndex, recordEmbeddingFailure } from "../llm/embeddings";
import { callEmbeddings } from "../llm/client";
import { deadline } from "../llm/deadline";
import { matchesIndexGeneration } from "../llm/settings-store";
import { enforceSearchEmbeddingLimit, enforceSearchLimit } from "../rate-limit";
import { materialize, type SearchScope, type StoredResult } from "./candidates";

export type SearchCursor = { capability: string; nextOrdinal: number };
type Request = SearchScope & {
  text: string;
  limit: number;
  capability?: string;
  cursor?: SearchCursor;
  actor?: Actor;
  ip?: string;
  signal?: AbortSignal;
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const restart = () => new DomainError("CONFLICT", "SEARCH_RESTART_REQUIRED");
async function admin(trx: Transaction<DB>, request: Request, hold = false) {
  if (request.surface === "activity") {
    if (!request.actor || request.actor.userId !== request.userId)
      throw new DomainError("FORBIDDEN", "ADMIN_REQUIRED");
    await requireAdmin(trx, request.actor, hold);
  }
}
function page(
  row: {
    status: string;
    mode: string;
    truncated: boolean;
    total: number;
    entries: StoredResult[];
  },
  capability: string,
  ordinal: number,
) {
  if (row.status === "failed") throw restart();
  if (ordinal > row.total) throw restart();
  const next = ordinal + row.entries.length;
  return {
    entries: row.entries,
    nextCursor:
      next < row.total ? { capability, nextOrdinal: next } : undefined,
    search: {
      capability,
      mode: row.mode as "exact" | "semantic",
      status: row.status as "ready" | "pending",
      truncated: row.truncated,
      total: row.total,
    },
  };
}
export function readStoredPage(
  connection: Kysely<DB>,
  id: string,
  filters: string,
  ordinal: number,
  limit: number,
) {
  return connection
    .selectFrom("search_session")
    .select([
      "status",
      "mode",
      "truncated",
      "epoch",
      "queryHash",
      "surface",
      "userId",
    ])
    .select([
      sql<number>`jsonb_array_length(results)`.as("total"),
      sql<
        StoredResult[]
      >`jsonb_path_query_array(results, ${`$[${ordinal} to ${ordinal + limit - 1}]`}::jsonpath)`.as(
        "entries",
      ),
      sql<boolean>`filters=${filters}::jsonb and "expiresAt">clock_timestamp()`.as(
        "compatible",
      ),
    ])
    .where("capabilityHash", "=", id)
    .executeTakeFirst();
}
export async function searchPage(request: Request) {
  const text = canonicalSearchText(request.text);
  validateDatabaseText(text);
  if (
    !text ||
    !Number.isInteger(request.limit) ||
    request.limit < 1 ||
    request.limit > 100
  )
    throw new DomainError("BAD_REQUEST", "INVALID_SEARCH");
  const ordinal = request.cursor?.nextOrdinal ?? 0;
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal > 1000)
    throw restart();
  const capability = request.cursor?.capability ?? request.capability ?? "";
  if (
    !capability ||
    capability.length > 144 ||
    (request.cursor && request.capability && request.capability !== capability)
  )
    throw restart();
  const id = hash(capability),
    queryHash = hash(text);
  const scope: SearchScope = {
    surface: request.surface,
    userId: request.surface === "activity" ? request.userId : null,
    filters: {
      status: request.filters.status ?? null,
      orderBy: request.filters.orderBy ?? "newest",
      categories: [...new Set(request.filters.categories ?? [])].sort(),
      unseenOnly: !!request.filters.unseenOnly,
      unscreenedOnly: !!request.filters.unscreenedOnly,
      excludeFeedback: !!request.filters.excludeFeedback,
      excludeComments: !!request.filters.excludeComments,
    },
  };
  const filters = JSON.stringify(scope.filters);
  if (Buffer.byteLength(filters) > 4096)
    throw new DomainError("BAD_REQUEST", "INVALID_SEARCH");
  async function existing(trx: Transaction<DB>) {
    await admin(trx, request);
    const stored = await readStoredPage(
      trx,
      id,
      filters,
      ordinal,
      request.limit,
    );
    if (!stored) return;
    if (
      !stored.compatible ||
      stored.queryHash !== queryHash ||
      stored.surface !== scope.surface ||
      stored.userId !== scope.userId
    )
      throw restart();
    if (
      stored.mode === "semantic" &&
      (!stored.epoch || !(await matchesIndexGeneration(trx, stored.epoch)))
    )
      throw restart();
    return page(stored, capability, ordinal);
  }
  const initial = await contentTransaction(request.signal, async (trx) => {
    const settings = await trx
      .selectFrom("settings")
      .select("setupCompletedAt")
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    if (!settings.setupCompletedAt)
      throw new DomainError("FORBIDDEN", "SETUP_REQUIRED");
    return existing(trx);
  });
  if (initial) return initial;
  const expiresAt = searchExpiry(capability);
  if (request.cursor || !expiresAt) throw restart();
  if (request.ip && !(await enforceSearchLimit(request.ip)).allowed)
    throw new DomainError("TOO_MANY_REQUESTS", "RATE_LIMITED", 60);
  const claimed = await contentTransaction(request.signal, async (trx) => {
    await lock(trx, locks.search);
    const found = await existing(trx);
    if (found) return found;
    const {
      rows: [clock],
    } = await sql<{
      live: boolean;
    }>`select ${expiresAt}::timestamptz > clock_timestamp() as live`.execute(
      trx,
    );
    if (!clock.live) throw restart();
    await trx
      .deleteFrom("search_session")
      .where("expiresAt", "<=", sql<Date>`clock_timestamp()`)
      .execute();
    const { count } = await trx
      .selectFrom("search_session")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();
    if (Number(count) >= 1000)
      throw new DomainError("TOO_MANY_REQUESTS", "SEARCH_BUSY", 60);
    await trx
      .insertInto("search_session")
      .values({
        capabilityHash: id,
        expiresAt,
        queryHash,
        filters: scope.filters,
        surface: scope.surface,
        userId: scope.userId,
        mode: "exact",
        status: "pending",
      })
      .execute();
  });
  if (claimed) return claimed;
  try {
    let semantic: { index: IndexSnapshot; vector: number[] } | undefined;
    try {
      const index = await indexSnapshot(false, request.signal);
      if (
        usableIndex(index) &&
        (!request.ip || (await enforceSearchEmbeddingLimit(request.ip)).allowed)
      ) {
        try {
          const [vector] = await callEmbeddings("embed-query", [text], {
            signal: request.signal,
            content: {
              config: index.config,
              wall: deadline(index.config.options.timeoutMs, request.signal),
            },
          });
          if (vector) semantic = { index, vector };
        } catch (error) {
          recordEmbeddingFailure(index, error);
        }
      }
    } catch (error) {
      if (request.signal?.aborted) throw error;
    }
    request.signal?.throwIfAborted();
    return await contentTransaction(
      request.signal,
      async (trx) => {
        await admin(trx, request, true);
        if (semantic) await guardIndex(trx, semantic.index);
        const { results, truncated } = await materialize(
          trx,
          scope,
          text,
          semantic
            ? {
                vector: semantic.vector,
                physical: semantic.index.physical!,
                maxDistance: semantic.index.config.options.searchMaxDistance,
              }
            : undefined,
        );
        request.signal?.throwIfAborted();
        const row = await trx
          .updateTable("search_session")
          .where("capabilityHash", "=", id)
          .where("status", "=", "pending")
          .where("expiresAt", ">", sql<Date>`clock_timestamp()`)
          .set({
            mode: semantic ? "semantic" : "exact",
            status: "ready",
            epoch: semantic?.index.epoch ?? null,
            fingerprint: semantic?.index.fingerprint ?? null,
            queryVector: semantic
              ? Buffer.from(new Float32Array(semantic.vector).buffer)
              : null,
            results: sql`${JSON.stringify(results)}::jsonb`,
            truncated,
          })
          .returning(["mode", "status", "truncated"])
          .executeTakeFirst();
        if (!row) throw restart();
        await admin(trx, request);
        return page(
          {
            ...row,
            total: results.length,
            entries: results.slice(0, request.limit),
          },
          capability,
          0,
        );
      },
      "repeatable read",
    );
  } catch (error) {
    await contentTransaction(AbortSignal.timeout(250), (trx) =>
      trx
        .updateTable("search_session")
        .set({ status: "failed" })
        .where("capabilityHash", "=", id)
        .where("status", "=", "pending")
        .execute(),
    ).catch(() => {});
    if (request.signal?.aborted)
      throw new DomainError("CLIENT_CLOSED_REQUEST", "REQUEST_CANCELLED");
    if (error instanceof DomainError) throw error;
    throw restart();
  }
}
