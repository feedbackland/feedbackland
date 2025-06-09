"server-only";

import { db } from "@/db/db";

export const updateSubscriptionQuery = async ({
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
      .updateTable("subscriptions")
      .where("orgId", "=", orgId)
      .where("subscriptionId", "=", subscriptionId)
      .set({
        customerId,
        productId,
        status,
      })
      .execute();
  } catch (error) {
    console.error(error);
  }
};
