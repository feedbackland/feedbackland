import { adminProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";
import { getAdminsQuery } from "@/queries/get-admins";

export const getIsAdminLimitReached = adminProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const [{ activeSubscription }, admins] = await Promise.all([
        getSubscriptionQuery({ orgId }),
        getAdminsQuery({ orgId }),
      ]);

      const adminCount = admins.length;

      if (
        (activeSubscription === "free" && adminCount >= 1) ||
        (activeSubscription === "pro" && adminCount >= 1)
      ) {
        return true;
      }

      return false;
    } catch (error) {
      throw error;
    }
  },
);
