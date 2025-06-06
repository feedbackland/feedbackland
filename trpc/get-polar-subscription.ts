import { adminProcedure } from "@/lib/trpc";
import { polar } from "@/lib/polar";

export const getPolarSubscription = adminProcedure.query(
  async ({ ctx: { orgId, orgPolarSubscriptionId } }) => {
    try {
      if (!orgPolarSubscriptionId) {
        return null;
      }

      const customerSession = await polar.customerSessions.create({
        customerExternalId: orgId,
      });

      if (!customerSession?.token) {
        return null;
      }

      const subscription = await polar.customerPortal.subscriptions.get(
        {
          customerSession: customerSession.token,
        },
        {
          id: orgPolarSubscriptionId,
        },
      );

      if (!subscription) {
        return null;
      }

      return subscription;
    } catch (error) {
      throw error;
    }
  },
);
