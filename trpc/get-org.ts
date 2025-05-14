import { publicProcedure } from "@/lib/trpc";
import { getOrgQuery } from "@/queries/get-org";

export const getOrg = publicProcedure.query(
  async ({ ctx: { orgSubdomain } }) => {
    const org = await getOrgQuery({
      orgSubdomain: orgSubdomain || "",
    });

    return org;
  },
);
