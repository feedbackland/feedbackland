import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sql, type Selectable, type Transaction } from "kysely";
import { db } from "../../db/db";
import { lock, locks } from "../../db/locks";
import type { DB, SearchSession } from "../../db/schema";
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
  row: Selectable<SearchSession>,
  capability: string,
  ordinal: number,
  limit: number,
) {
  if (row.status === "failed") throw restart();
  const results = row.results as StoredResult[];
  if (ordinal > results.length) throw restart();
  const next = Math.min(results.length, ordinal + limit);
  return {
    entries: results.slice(ordinal, next),
    nextCursor:
      next < results.length ? { capability, nextOrdinal: next } : undefined,
    search: {
      capability,
      mode: row.mode as "exact" | "semantic",
      status: row.status as "ready" | "pending",
      truncated: row.truncated,
      total: results.length,
    },
  };
}
export async function searchPage(request: Request) {
  const text = Array.from(request.text.trim().normalize("NFC"))
    .slice(0, 200)
    .join("");
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
  const capability =
    request.cursor?.capability ??
    request.capability ??
    randomBytes(32).toString("hex");
  if (
    !/^[0-9a-f]{64}$/.test(capability) ||
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
    const stored = await trx
      .selectFrom("search_session")
      .selectAll()
      .select(
        sql<boolean>`filters=${filters}::jsonb and "expiresAt">clock_timestamp()`.as(
          "compatible",
        ),
      )
      .where("capabilityHash", "=", id)
      .executeTakeFirst();
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
    return page(stored, capability, ordinal, request.limit);
  }
  const initial = await contentTransaction(request.signal, existing);
  if (initial) return initial;
  if (request.cursor) throw restart();
  if (request.ip && !(await enforceSearchLimit(request.ip)).allowed)
    throw new DomainError("TOO_MANY_REQUESTS", "RATE_LIMITED", 60);
  const claimed = await contentTransaction(request.signal, async (trx) => {
    await lock(trx, locks.search);
    const found = await existing(trx);
    if (found) return found;
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
    return await db
      .transaction()
      .setIsolationLevel("repeatable read")
      .execute(async (trx) => {
        await sql`set local statement_timeout='5s'`.execute(trx);
        await sql`set local lock_timeout='5s'`.execute(trx);
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
          .returningAll()
          .executeTakeFirst();
        if (!row) throw restart();
        await admin(trx, request);
        return page(row, capability, 0, request.limit);
      });
  } catch (error) {
    await db
      .updateTable("search_session")
      .set({ status: "failed" })
      .where("capabilityHash", "=", id)
      .where("status", "=", "pending")
      .execute()
      .catch(() => {});
    if (request.signal?.aborted)
      throw new DomainError("CLIENT_CLOSED_REQUEST", "REQUEST_CANCELLED");
    if (error instanceof DomainError) throw error;
    throw restart();
  }
}
