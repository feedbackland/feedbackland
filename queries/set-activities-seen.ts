"server-only";

import { db } from "@/db/db";

export const setActivitiesSeenQuery = async ({
  userId,
  itemIds, // Accept an array of items
}: {
  userId: string;
  itemIds: string[]; // Use the defined type
}) => {
  // If no items are provided, do nothing
  if (itemIds.length === 0) {
    return;
  }

  // Map the input items array to the database structure
  const valuesToInsert = itemIds.map((itemId) => ({
    userId,
    itemId,
  }));

  try {
    await db
      .insertInto("activity_seen") // Use the correct table name
      .values(valuesToInsert) // Insert the array of values
      // Use the correct composite primary key columns for conflict resolution
      .onConflict((oc) => oc.columns(["userId", "itemId"]).doNothing())
      .execute();
  } catch (error) {
    console.error("Error batch updating activity seen status:", error);
    // Re-throw the error to be handled by the caller (e.g., tRPC procedure)
    throw error;
  }
};
