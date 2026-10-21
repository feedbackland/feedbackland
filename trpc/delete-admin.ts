import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { deleteAdminQuery } from "@/queries/delete-admin";

export const deleteAdmin = adminProcedure
  .input(
    z.object({
      adminId: z.string(),
    }),
  )
  .mutation(async ({ input: { adminId }, ctx: { userId, sessionId } }) => {
    try {
      return await deleteAdminQuery({
        userId,

        sessionId,
        adminId,
      });
    } catch (error) {
      throw error;
    }
  });
