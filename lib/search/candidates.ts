import "server-only";
import { sql, type RawBuilder, type Transaction } from "kysely";
import type { DB } from "../../db/schema";
import { vectorDistance } from "../../db/vector";
import type { VectorMetadata } from "../runtime-state";
import type {
  FeedbackStatus,
  FeedbackCategories,
  FeedbackOrderBy,
} from "../typings";

export type SearchFilters = {
  status: FeedbackStatus;
  orderBy: FeedbackOrderBy;
  categories?: FeedbackCategories;
  excludeFeedback?: boolean;
  excludeComments?: boolean;
  unseenOnly?: boolean;
  unscreenedOnly?: boolean;
};
export type SearchScope = {
  surface: "board" | "activity";
  userId: string | null;
  filters: SearchFilters;
};
export type Candidate = {
  kind: "post" | "comment";
  id: string;
  distance: number | null;
};
export type StoredResult = [Candidate["kind"], string, number | null];
export const resultLimit = 1000;
export async function prepareSemanticScan(
  trx: Transaction<DB>,
  version: string,
) {
  const [major, minor] = version.split(".").map(Number);
  if (major > 0 || minor >= 8) {
    await sql`select set_config('hnsw.iterative_scan','strict_order',true),
      set_config('hnsw.max_scan_tuples','20000',true)`.execute(trx);
    return resultLimit;
  }
  await sql`set local hnsw.ef_search=400`.execute(trx);
  return 400;
}
type Semantic = {
  vector: number[];
  physical: VectorMetadata;
  maxDistance: number;
};
function sources({ surface, filters }: SearchScope) {
  const result: Candidate["kind"][] = [];
  if (!filters.excludeFeedback) result.push("post");
  if (
    surface === "activity" &&
    !filters.excludeComments &&
    !filters.status &&
    !filters.categories?.length
  )
    result.push("comment");
  return result;
}
function conditions(kind: Candidate["kind"], scope: SearchScope) {
  const filters = scope.filters,
    clauses: RawBuilder<unknown>[] = [sql`true`];
  if (kind === "post") {
    if (filters.status) clauses.push(sql`i.status=${filters.status}`);
    if (filters.categories?.length)
      clauses.push(sql`i.category in (${sql.join(filters.categories)})`);
  } else if (!filters.unscreenedOnly)
    clauses.push(sql`i.content not like 'Updated status to%'`);
  if (filters.unseenOnly)
    clauses.push(
      sql`not exists(select 1 from activity_seen s where s."itemId"=i.id and s."userId"=${scope.userId})`,
    );
  if (filters.unscreenedOnly)
    clauses.push(sql`i."moderationState" in ('unscreened','screened-text')`);
  return sql.join(clauses, sql` and `);
}
export function semanticCandidates(
  scope: SearchScope,
  semantic: Semantic,
  limit: number,
) {
  const queries = sources(scope).map((kind) => {
    const table = sql.table(kind === "post" ? "feedback" : "comment");
    const distance = vectorDistance(
      sql.ref("i.embedding"),
      semantic.vector,
      semantic.physical,
    );
    // The inner index scan must order only by the distance operator. Apply
    // deterministic tie-breaks after the approximate candidate set is bounded.
    return sql`(select ${sql.lit(kind)}::text as kind,i.id,${distance} as distance from ${table} i
      where ${conditions(kind, scope)} and i.embedding is not null order by ${distance} limit ${limit})`;
  });
  if (!queries.length) return null;
  return sql<Candidate>`select * from (${sql.join(queries, sql` union all `)}) candidates where distance<=${semantic.maxDistance}
    order by distance,kind,id limit ${limit}`;
}
export async function materialize(
  trx: Transaction<DB>,
  scope: SearchScope,
  text: string,
  semantic?: Semantic,
) {
  const candidates: Candidate[] = [];
  let truncated = false;
  if (semantic) {
    const cap = await prepareSemanticScan(trx, semantic.physical.version);
    const query = semanticCandidates(scope, semantic, cap + 1);
    if (query) {
      const { rows } = await query.execute(trx);
      truncated =
        rows.length > cap || (cap < resultLimit && rows.length === cap);
      candidates.push(...rows.slice(0, cap));
    }
  }
  const pattern = "%" + text.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const room = resultLimit - candidates.length;
  // The semantic tail is chronological. A wholly exact session honors the list's selected sort.
  const tieBreak = semantic ? sql`kind,id` : sql`id desc,kind`;
  const exact = sources(scope).map((kind) => {
    const table = sql.table(kind === "post" ? "feedback" : "comment");
    const match =
      kind === "post"
        ? sql`(normalize(i.title, NFC) ilike ${pattern} or normalize(i."plainText", NFC) ilike ${pattern})`
        : sql`normalize(i."plainText", NFC) ilike ${pattern}`;
    let sortKey = sql`i."createdAt"`;
    if (!semantic && scope.filters.orderBy === "upvotes")
      sortKey = sql`i.upvotes`;
    if (!semantic && scope.filters.orderBy === "comments") {
      const visible =
        scope.surface === "activity"
          ? sql`and c.content not like 'Updated status to%'`
          : sql``;
      sortKey =
        kind === "comment"
          ? sql`0::bigint`
          : sql`(select count(*) from comment c where c."postId"=i.id ${visible})`;
    }
    return sql`(select ${sql.lit(kind)}::text as kind,i.id,${sortKey} as sort_key,null::double precision as distance from ${table} i
      where ${conditions(kind, scope)} and ${match} ${semantic ? sql`and (i.embedding is null or i."embeddingSkipped")` : sql``}
      order by sort_key desc,${tieBreak} limit ${room + 1})`;
  });
  if (exact.length) {
    const { rows } =
      await sql<Candidate>`select * from (${sql.join(exact, sql` union all `)}) matches order by sort_key desc,${tieBreak} limit ${room + 1}`.execute(
        trx,
      );
    truncated ||= rows.length > room;
    candidates.push(...rows.slice(0, room));
  }
  const results: StoredResult[] = [];
  let bytes =
    Buffer.byteLength(JSON.stringify(scope.filters)) +
    128 +
    (semantic?.vector.length ?? 0) * 4;
  const seen = new Set<string>();
  for (const row of candidates) {
    const key = row.kind + row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry: StoredResult = [row.kind, row.id, row.distance];
    bytes += Buffer.byteLength(JSON.stringify(entry)) + 8;
    if (bytes > 131072) {
      truncated = true;
      break;
    }
    results.push(entry);
  }
  return { results, truncated };
}
