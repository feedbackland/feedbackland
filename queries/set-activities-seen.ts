"server-only";

import { db } from "@/db/db";

export const setActivitiesSeenQuery = async ({
  userId,
  itemIds,
}: {
  userId: string;
  itemIds: string[];
}) => {
  if (itemIds.length === 0) {
    return;
  }

  const valuesToInsert = itemIds.map((itemId) => ({
    userId,
    itemId,
  }));

  try {
    await db
      .insertInto("activity_seen")
      .values(valuesToInsert)
      .onConflict((oc) => oc.columns(["userId", "itemId"]).doNothing())
      .execute();
  } catch (error) {
    throw error;
  }
};
