import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { redeemAdminInviteQuery } from "@/queries/redeem-admin-invite";

export const redeemAdminInvite = userProcedure
  .input(
    z.object({
      adminInviteToken: z.string().uuid(),
    }),
  )
  .mutation(async ({ input: { adminInviteToken }, ctx: { userId, orgId } }) => {
    try {
      return await redeemAdminInviteQuery({
        adminInviteToken,
        userId,
        orgId,
      });
    } catch (error) {
      throw error;
    }
  });
