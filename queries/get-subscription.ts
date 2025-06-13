"server-only";

import { db } from "@/db/db";

export const getSubscriptionQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const subscription = await db
      .selectFrom("subscriptions")
      .where("orgId", "=", orgId)
      .selectAll()
      .executeTakeFirst();

    if (subscription) {
      console.log("validUntil", subscription?.validUntil);
      console.log("typeof validUntil", typeof subscription?.validUntil);

      const isExpired = !!(
        subscription.status === "canceled" &&
        subscription?.validUntil &&
        subscription.validUntil < new Date()
      );

      return { ...subscription, isExpired };
    }

    return null;
  } catch (error) {
    throw error;
  }
};
