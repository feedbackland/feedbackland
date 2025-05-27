import { z } from "zod";
import { publicProcedure } from "@/lib/trpc";
import { getAdminInviteQuery } from "@/queries/get-admin-invite";

export const getAdminInvite = publicProcedure
  .input(
    z.object({
      adminInviteToken: z.string().uuid(),
    }),
  )
  .query(async ({ input: { adminInviteToken }, ctx: { orgId } }) => {
    try {
      return await getAdminInviteQuery({
        adminInviteToken,
        orgId,
      });
    } catch (error) {
      throw error;
    }
  });
