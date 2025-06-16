import { adminProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";

export const getSubscription = adminProcedure.query(
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
