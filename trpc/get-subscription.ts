import { adminProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";

export const getSubscription = adminProcedure.query(
  async ({ ctx: { orgId, userId } }) => {
    try {
      const subscription = getSubscriptionQuery({
        userId,
        orgId,
      });

      return subscription;
    } catch (error) {
      throw error;
    }
  },
);
