import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { updateOrgQuery } from "@/queries/update-org";

export const updateOrg = adminProcedure
  .input(
    z.object({
      orgName: z.string().nullish(),
      orgSubdomain: z.string().optional(),
      platformTitle: z.string().optional(),
      platformDescription: z.string().nullish(),
    }),
  )
  .mutation(
    async ({
      input: { orgName, orgSubdomain, platformTitle, platformDescription },
      ctx: { userId, orgId },
    }) => {
      try {
        return await updateOrgQuery({
          userId,
          orgId,
          orgName,
          orgSubdomain,
          platformTitle,
          platformDescription,
        });
      } catch (error) {
        throw error;
      }
    },
  );
