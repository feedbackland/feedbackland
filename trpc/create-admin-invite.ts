import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { createAdminInviteQuery } from "@/queries/create-admin-invite";

export const createAdminInvite = adminProcedure
  .input(
    z.object({
      platformUrl: z.string().min(1),
      invitedBy: z.string().min(1),
      email: z.email(),
    }),
  )
  .mutation(async (opts) => {
    try {
      const {
        input: { platformUrl, invitedBy, email },
        ctx: { orgId, userId },
      } = opts;

      const adminInvite = await createAdminInviteQuery({
        email,
        orgId,
        userId,
      });

      const inviteLink = `${platformUrl}?admin-invite-token=${adminInvite.token}&admin-invite-email=${email}`;
      return { success: true, inviteLink };
    } catch (error) {
      throw error;
    }
  });
