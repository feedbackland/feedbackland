import { Webhooks } from "@polar-sh/nextjs";
import { createSubscriptionQuery } from "@/queries/create-subscription";
import { updateSubscriptionQuery } from "@/queries/update-subscription";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    const { data: subscription } = payload;

    if (!subscription?.customer?.externalId) {
      throw new Error("Customer externalId not found");
    }

    try {
      await createSubscriptionQuery({
        orgId: subscription.customer.externalId,
        subscriptionId: subscription.id,
        customerId: subscription.customer.id,
        productId: subscription.product.id,
        status: subscription.status,
      });
    } catch (error) {
      console.error(error);
    }
  },

  onSubscriptionUpdated: async (payload) => {
    const { data: subscription } = payload;

    if (!subscription?.customer?.externalId) {
      throw new Error("Customer externalId not found");
    }

    try {
      await updateSubscriptionQuery({
        orgId: subscription.customer.externalId,
        subscriptionId: subscription.id,
        customerId: subscription.customer.id,
        productId: subscription.product.id,
        status: subscription.status,
      });
    } catch (error) {
      console.error(error);
    }
  },
});
