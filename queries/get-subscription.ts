"server-only";

import { db } from "@/db/db";
import { getIsSelfHosted } from "@/lib/utils";
import { Selectable } from "kysely";
import { Subscriptions } from "@/db/schema";

type Subscription = Partial<Selectable<Subscriptions>> & {
  activeSubscription: "free" | "pro" | "max";
  isExpired: boolean;
};

export const getSubscriptionQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const isSelfHosted = getIsSelfHosted();

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
      } satisfies Subscription;
    }

    return {
      orgId,
      amount: "0",
      name: isSelfHosted ? "max" : "free",
      activeSubscription: isSelfHosted ? "max" : "free",
      frequency: "year",
      isExpired: false,
    } satisfies Subscription;
  } catch (error) {
    throw error;
  }
};
