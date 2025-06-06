import { Webhooks } from "@polar-sh/nextjs";
import { db } from "@/db/db";
import { emitter } from "@/lib/event-emitter";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    const { data: subscription } = payload;
    const polarSubscriptionId = subscription.id;
    const orgId = subscription.customer.externalId;

    if (orgId) {
      try {
        await db
          .updateTable("org")
          .set({ polarSubscriptionId })
          .where("id", "=", orgId)
          .execute();

        emitter.emit("message", { text: "Subscription created" });
      } catch (error) {
        console.error(error);
      }
    }
  },
});
