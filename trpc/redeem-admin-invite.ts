import "server-only";
import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { redeemAdminInviteQuery } from "@/queries/redeem-admin-invite";

export const redeemAdminInvite = userProcedure
  .input(
    z.object({
      adminInviteToken: z.uuid(),
    }),
  )
  .mutation(
    async ({ input: { adminInviteToken }, ctx: { userId, sessionId } }) => {
      try {
        return await redeemAdminInviteQuery({
          adminInviteToken,
          userId,

          sessionId,
        });
      } catch (error) {
        throw error;
      }
    },
  );
