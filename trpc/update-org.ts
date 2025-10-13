import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { updateOrgQuery } from "@/queries/update-org";

export const updateOrg = adminProcedure
  .input(
    z.object({
      orgSubdomain: z.string().optional(),
      orgName: z.string().optional(),
      orgUrl: z.string().optional(),
      platformTitle: z.string().optional(),
      platformDescription: z.string().nullish(),
      logo: z.string().nullish(),
    }),
  )
  .mutation(
    async ({
      input: {
        orgSubdomain,
        orgName,
        orgUrl,
        platformTitle,
        platformDescription,
        logo,
      },
      ctx: { userId, orgId },
    }) => {
      try {
        return await updateOrgQuery({
          userId,
          orgId,
          orgSubdomain,
          orgName,
          orgUrl,
          platformTitle,
          platformDescription,
          logo,
        });
      } catch (error) {
        throw error;
      }
    },
  );
