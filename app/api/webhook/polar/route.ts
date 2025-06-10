import { Webhooks } from "@polar-sh/nextjs";
import { createSubscriptionQuery } from "@/queries/create-subscription";
import { updateSubscriptionQuery } from "@/queries/update-subscription";
import { adminDatabase } from "@/lib/firebase/admin";
import { database } from "firebase-admin";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    const { data: subscription } = payload;

    if (!subscription?.customer?.externalId) {
      throw new Error("Customer externalId not found");
    }

    const orgId = subscription.customer.externalId;

    try {
      await createSubscriptionQuery({
        orgId,
        subscriptionId: subscription.id,
        customerId: subscription.customer.id,
        productId: subscription.product.id,
        status: subscription.status,
      });

      await adminDatabase
        .ref(`subscriptions/${orgId}`)
        .set(database.ServerValue.TIMESTAMP);
    } catch (error) {
      console.error(error);
    }
  },

  onSubscriptionUpdated: async (payload) => {
    const { data: subscription } = payload;

    if (!subscription?.customer?.externalId) {
      throw new Error("Customer externalId not found");
    }

    const orgId = subscription.customer.externalId;

    try {
      await updateSubscriptionQuery({
        orgId: subscription.customer.externalId,
        subscriptionId: subscription.id,
        customerId: subscription.customer.id,
        productId: subscription.product.id,
        status: subscription.status,
      });

      await adminDatabase
        .ref(`subscriptions/${orgId}`)
        .set(database.ServerValue.TIMESTAMP);
    } catch (error) {
      console.error(error);
    }
  },
});
