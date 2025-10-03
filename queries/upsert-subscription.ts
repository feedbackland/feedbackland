"server-only";

import { db } from "@/db/db";
import { SubscriptionName, SubscriptionFrequency } from "@/db/schema";

export const upsertSubscriptionQuery = async ({
  orgId,
  subscriptionId,
  customerId,
  productId,
  status,
  name,
  frequency,
  validUntil,
  amount,
  email,
}: {
  orgId: string;
  subscriptionId: string;
  customerId: string;
  productId: string;
  status: string;
  name: SubscriptionName;
  frequency: SubscriptionFrequency;
  validUntil: Date | null;
  amount: number;
  email: string | null;
}) => {
  try {
    return await db.transaction().execute(async (trx) => {
      let subscription = await trx
        .selectFrom("subscriptions")
        .where("orgId", "=", orgId)
        .selectAll()
        .executeTakeFirst();

      if (!subscription) {
        subscription = await trx
          .insertInto("subscriptions")
          .values({
            orgId,
            subscriptionId,
            customerId,
            productId,
            status,
            name,
            frequency,
            amount,
            validUntil,
            email,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        subscription = await trx
          .updateTable("subscriptions")
          .where("orgId", "=", orgId)
          .set({
            orgId,
            subscriptionId,
            customerId,
            productId,
            status,
            name,
            frequency,
            amount,
            validUntil,
            email,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      return subscription;
    });
  } catch (error) {
    throw error;
  }
};
