import { publicProcedure } from "@/lib/trpc";

export const getOrg = publicProcedure.query(
  async ({ ctx: { orgId, orgName, orgSubdomain, orgIsClaimed } }) => {
    return {
      orgId,
      orgName,
      orgSubdomain,
      orgIsClaimed,
    };
  },
);
