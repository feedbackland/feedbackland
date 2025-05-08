"server-only";

import { db } from "@/db/db";
import { InsightsCursor } from "@/lib/typings";

export const getInsightsQuery = async ({
  orgId,
  cursor,
  limit,
}: {
  orgId: string;
  cursor: InsightsCursor | null | undefined;
  limit: number;
}) => {
  try {
    let query = db
      .selectFrom("insights")
      .selectAll()
      .where("insights.orgId", "=", orgId)
      .orderBy("insights.priority", "desc")
      .orderBy("insights.id", "desc");

    if (cursor) {
      // When sorting by priority DESC and id DESC,
      // the next page starts with items that have:
      // 1. A priority strictly less than the cursor's priority, OR
      // 2. The same priority as the cursor, but an ID strictly less than the cursor's ID.
      query = query.where((eb) => {
        return eb.or([
          eb("insights.priority", "<", String(cursor.priority)),
          eb.and([
            eb("insights.priority", "=", String(cursor.priority)),
            eb("insights.id", "<", cursor.id),
          ]),
        ]);
      });
    }

    query = query.limit(limit + 1);

    const items = await query.execute();

    let nextCursor: InsightsCursor | undefined = undefined;

    if (items.length > limit) {
      const nextItem = items.pop();

      if (nextItem) {
        nextCursor = {
          id: nextItem.id,
          priority: Number(nextItem.priority),
          createdAt: nextItem.createdAt.toISOString(),
        };
      }
    }

    return {
      items,
      nextCursor,
    };
  } catch (error: any) {
    throw error;
  }
};
