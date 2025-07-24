import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { deleteAdminInviteQuery } from "@/queries/delete-admin-invite";

export const deleteAdminInvite = adminProcedure
  .input(
    z.object({
      adminInviteId: z.uuid(),
    }),
  )
  .mutation(async ({ input: { adminInviteId }, ctx: { userId, orgId } }) => {
    try {
      return await deleteAdminInviteQuery({
        adminInviteId,
        userId,
        orgId,
      });
    } catch (error) {
      throw error;
    }
  });
