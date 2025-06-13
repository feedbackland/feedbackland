import { Webhooks } from "@polar-sh/nextjs";
import { upsertSubscriptionQuery } from "@/queries/upsert-subscription";
import { adminDatabase } from "@/lib/firebase/admin";
import { database } from "firebase-admin";

const getName = (inputName: string) => {
  if (inputName.toLowerCase().includes("pro")) {
    return "pro";
  } else if (inputName.toLowerCase().includes("max")) {
    return "max";
  }

  return "free";
};

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onPayload: async (payload) => {
    const type = payload?.type;

    if (
      type === "subscription.created" ||
      type === "subscription.active" ||
      type === "subscription.canceled" ||
      type === "subscription.uncanceled" ||
      type === "subscription.revoked"
    ) {
      const { data: subscription } = payload;
      const orgId = subscription?.customer?.externalId;

      if (orgId) {
        await upsertSubscriptionQuery({
          orgId,
          subscriptionId: subscription.id,
          customerId: subscription.customer.id,
          productId: subscription.product.id,
          status: subscription.status,
          frequency: subscription.recurringInterval,
          name: getName(subscription.product.name),
          validUntil: subscription.currentPeriodEnd,
          amount: Math.round(subscription.amount / 100),
        });

        await adminDatabase
          .ref(`subscriptions/${orgId}`)
          .set(database.ServerValue.TIMESTAMP);
      }
    }
  },
});
