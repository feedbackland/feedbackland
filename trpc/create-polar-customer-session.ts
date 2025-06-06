import { adminProcedure } from "@/lib/trpc";
import { polar } from "@/lib/polar";

export const createPolarCustomerSession = adminProcedure.mutation(
  async ({ ctx: { orgId } }) => {
    try {
      const result = await polar.customerSessions.create({
        customerExternalId: orgId,
      });

      return result;
    } catch (error) {
      throw error;
    }
  },
);
