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
      const isExpired = !!(
        subscription?.validUntil &&
        subscription.validUntil.getTime() < new Date().getTime()
      );

      return { ...subscription, isExpired };
    }

    return null;
  } catch (error) {
    throw error;
  }
};
