"server-only";

import { db } from "@/db/db";
import { getIsSelfHosted } from "@/lib/utils";
import { Selectable } from "kysely";
import { Subscriptions } from "@/db/schema";

type Subscription = Partial<Selectable<Subscriptions>> & {
  isExpired: boolean;
};

export const getSubscriptionQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const isSelfHosted = getIsSelfHosted("server");

    const subscription = await db
      .selectFrom("subscriptions")
      .where("orgId", "=", orgId)
      .selectAll()
      .executeTakeFirst();

    if (subscription) {
      const now = new Date();
      const isExpired = !!(
        subscription?.validUntil &&
        subscription.validUntil.getTime() < now.getTime()
      );
      const { orgId, amount, name, frequency } = subscription;

      return {
        orgId,
        amount,
        name,
        frequency,
        isExpired,
      } satisfies Subscription;
    }

    return {
      orgId,
      amount: "0",
      name: isSelfHosted ? "pro" : "free",
      frequency: "month",
      isExpired: false,
    } satisfies Subscription;
  } catch (error) {
    throw error;
  }
};
