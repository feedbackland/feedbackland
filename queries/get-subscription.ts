"server-only";

import { db } from "@/db/db";

export const getSubscriptionQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const subscription = await db
      .selectFrom("subscriptions")
      .where("orgId", "=", orgId)
      .selectAll()
      .executeTakeFirst();

    return subscription || null;
  } catch (error) {
    throw error;
  }
};
