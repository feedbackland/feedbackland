"server-only";

import { db } from "@/db/db";

export const createSubscriptionQuery = async ({
  orgId,
  subscriptionId,
  customerId,
  productId,
  status,
}: {
  orgId: string;
  subscriptionId: string;
  customerId: string;
  productId: string;
  status: string;
}) => {
  try {
    await db
      .insertInto("subscriptions")
      .values({
        orgId,
        subscriptionId,
        customerId,
        productId,
        status,
      })
      .execute();
  } catch (error) {
    console.error(error);
  }
};
