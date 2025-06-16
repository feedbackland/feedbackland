"server-only";

import { db } from "@/db/db";
import { Subscription } from "@/lib/typings";

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

      return {
        ...subscription,
        isExpired,
        activeSubscription,
      } satisfies Subscription;
    }

    return {
      orgId,
      amount: "0",
      name: "free",
      activeSubscription: "free",
      frequency: "month",
      isExpired: false,
    } satisfies Partial<Subscription>;
  } catch (error) {
    throw error;
  }
};
