import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { createAdminInviteQuery } from "@/queries/create-admin-invite";

export const createAdminInvite = adminProcedure
  .input(
    z.object({
      email: z.string().email(),
    }),
  )
  .mutation(async ({ input: { email }, ctx: { orgId } }) => {
    try {
      return await createAdminInviteQuery({
        email,
        orgId,
      });
    } catch (error) {
      throw error;
    }
  });
