"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";

export async function searchFeedbackPosts({
  orgId,
  searchTerm,
  pageSize,
  cursor,
}: {
  orgId: string;
  searchTerm: string;
  pageSize: number;
  cursor?: { rank: number; id: string };
}) {
  const query = db
    .selectFrom("feedback")
    .where("feedback.orgId", "=", orgId)
    .select([
      "id",
      "title",
      "description",
      "createdAt",
      // Calculate rank.  Use ts_rank_cd for better relevance.
      sql<number>`ts_rank_cd(
        ${sql.raw(
          // Combine tsvectors for overall ranking
          `(COALESCE(name_tsv, to_tsvector('english', name)) || ' ' || COALESCE(description_tsv, to_tsvector('english', description)))`,
        )},
        websearch_to_tsquery('english', ${searchTerm})
      )`.as("rank"),
    ])
    // Conditional WHERE clause for cursor pagination
    .$call((qb) => {
      if (cursor) {
        return qb.where((eb) =>
          eb.or([
            eb("rank" as any, "<", cursor.rank), // Lower rank (less relevant)
            eb.and([
              eb("rank" as any, "=", cursor.rank), // Same rank
              eb("id", "<", cursor.id), // But lower ID (tie-breaker)
            ]),
          ]),
        );
      }
      return qb;
    })
    .where((eb) =>
      eb.or([
        // Use pre-calculated tsvectors if they exist, otherwise calculate on-the-fly.
        eb(
          sql`${sql.raw("COALESCE(name_tsv, to_tsvector('english', name))")}`,
          "@@",
          sql`websearch_to_tsquery('english', ${searchTerm})`,
        ),
        eb(
          sql`${sql.raw("COALESCE(description_tsv, to_tsvector('english', description))")}`,
          "@@",
          sql`websearch_to_tsquery('english', ${searchTerm})`,
        ),
      ]),
    )
    .orderBy("rank", "desc") // Sort by rank (highest first)
    .orderBy("id", "desc") // Then by ID (for consistent ordering)
    .limit(pageSize);

  const results = await query.execute();

  let nextCursor: { rank: number; id: string } | null = null;

  if (results.length === pageSize) {
    const lastResult = results[results.length - 1];
    nextCursor = { rank: lastResult.rank, id: lastResult.id };
  }

  return { results, nextCursor };
}
