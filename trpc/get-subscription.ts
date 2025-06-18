import { publicProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";

export const getSubscription = publicProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const subscription = getSubscriptionQuery({
        orgId,
      });

      return subscription;
    } catch (error) {
      throw error;
    }
  },
);
