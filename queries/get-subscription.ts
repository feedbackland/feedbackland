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
      const activeSubscription = isExpired ? "free" : subscription.name;
      const { orgId, amount, name, frequency } = subscription;

      return {
        orgId,
        amount,
        name,
        activeSubscription,
        frequency,
        isExpired,
      };
    }

    return {
      orgId,
      amount: "0",
      name: "free",
      activeSubscription: "free",
      frequency: "month",
      isExpired: false,
    };
  } catch (error) {
    throw error;
  }
};
