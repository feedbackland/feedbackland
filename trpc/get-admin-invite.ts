import "server-only";
import { z } from "zod/v4";
import { publicProcedure } from "@/lib/trpc";
import { getAdminInviteQuery } from "@/queries/get-admin-invite";

export const getAdminInvite = publicProcedure
  .input(
    z.object({
      adminInviteToken: z.uuid(),
    }),
  )
  .query(async ({ input: { adminInviteToken }, ctx: {} }) => {
    try {
      return await getAdminInviteQuery({
        adminInviteToken,
      });
    } catch (error) {
      throw error;
    }
  });
