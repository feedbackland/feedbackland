import { Webhooks } from "@polar-sh/nextjs";
import { createSubscriptionQuery } from "@/queries/create-subscription";
import { updateSubscriptionQuery } from "@/queries/update-subscription";
import { adminDatabase } from "@/lib/firebase/admin";
import { database } from "firebase-admin";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    const { data: subscription } = payload;
    const orgId = subscription?.customer?.externalId;

    if (!orgId) {
      throw new Error("Customer externalId not found");
    }

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
    const orgId = subscription?.customer?.externalId;

    if (!orgId) {
      throw new Error("Customer externalId not found");
    }

    try {
      await updateSubscriptionQuery({
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

  onSubscriptionCanceled: async (payload) => {
    const { data: subscription } = payload;
    const orgId = subscription?.customer?.externalId;

    if (!orgId) {
      throw new Error("Customer externalId not found");
    }

    try {
      await updateSubscriptionQuery({
        orgId,
        subscriptionId: subscription.id,
        customerId: subscription.customer.id,
        productId: subscription.product.id,
        status: "canceled",
      });

      await adminDatabase
        .ref(`subscriptions/${orgId}`)
        .set(database.ServerValue.TIMESTAMP);
    } catch (error) {
      console.error(error);
    }
  },
});
