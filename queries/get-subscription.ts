"server-only";

import { db } from "@/db/db";
import { getIsSelfHosted } from "@/lib/utils";
import { Selectable } from "kysely";
import { Subscriptions } from "@/db/schema";
import { addDays } from "date-fns";

type Subscription = Partial<Selectable<Subscriptions>> & {
  isExpired: boolean;
  isTrial: boolean;
  trialEnd: string | null;
};

function isWithinLast30Days(orgCreatedAt: Date) {
  const createdAtDate = new Date(orgCreatedAt);
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  return createdAtDate > thirtyDaysAgo && createdAtDate <= now;
}

export const getSubscriptionQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const isSelfHosted = getIsSelfHosted("server");

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
      const { orgId, amount, name, frequency } = subscription;

      return {
        orgId,
        amount,
        name,
        frequency,
        isExpired,
        isTrial: false,
        trialEnd: null,
      } satisfies Subscription;
    }

    const org = await db
      .selectFrom("org")
      .where("org.id", "=", orgId)
      .selectAll()
      .executeTakeFirstOrThrow();

    const isTrial = !isSelfHosted && isWithinLast30Days(org.createdAt);
    // const isTrial = false;

    return {
      orgId,
      amount: "0",
      name: isSelfHosted || isTrial ? "pro" : "free",
      frequency: "month",
      isExpired: false,
      isTrial,
      trialEnd: isTrial ? addDays(org.createdAt, 30).toISOString() : null,
    } satisfies Subscription;
  } catch (error) {
    throw error;
  }
};
