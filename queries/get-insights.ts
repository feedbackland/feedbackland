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
  } catch (error) {
    throw error;
  }
};

export const getAllInsightsQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const items = await db
      .selectFrom("insights")
      .selectAll()
      .where("insights.orgId", "=", orgId)
      .orderBy("insights.priority", "desc")
      .orderBy("insights.id", "desc")
      .execute();

    return items;
  } catch (error) {
    throw error;
  }
};
