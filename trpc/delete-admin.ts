import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { deleteAdminQuery } from "@/queries/delete-admin";

export const deleteAdmin = adminProcedure
  .input(
    z.object({
      adminId: z.string(),
    }),
  )
  .mutation(async ({ input: { adminId }, ctx: { userId, orgId } }) => {
    try {
      return await deleteAdminQuery({
        userId,
        orgId,
        adminId,
      });
    } catch (error) {
      throw error;
    }
  });
