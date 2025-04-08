import { userProcedure } from "@/lib/trpc";
import { claimOrgQuery } from "@/queries/claim-org";

export const claimOrg = userProcedure.mutation(
  async ({ ctx: { userId, orgId } }) => {
    try {
      return await claimOrgQuery({
        userId,
        orgId,
      });
    } catch (error) {
      throw error;
    }
  },
);
