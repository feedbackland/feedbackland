import { adminProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";
import { getAdminsQuery } from "@/queries/get-admins";
import { getAdminUsageLimit } from "@/lib/utils";

export const getAdminUsage = adminProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const [{ activeSubscription }, admins] = await Promise.all([
        getSubscriptionQuery({ orgId }),
        getAdminsQuery({ orgId }),
      ]);

      const limit = getAdminUsageLimit(activeSubscription);
      const left = Number.isFinite(limit)
        ? Number(limit) - admins.length
        : undefined;
      const limitReached = Number(left) <= 0;

      return {
        limit,
        limitReached,
        left,
      };
    } catch (error) {
      throw error;
    }
  },
);
