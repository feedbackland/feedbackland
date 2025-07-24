import { userProcedure } from "@/lib/trpc";
import { getUserSessionQuery } from "@/queries/get-user-session";
import z from "zod/v4";

export const getUserSession = userProcedure
  .input(z.object({}))
  .query(async ({ ctx: { orgId, userId } }) => {
    try {
      const session = await getUserSessionQuery({
        orgId,
        userId,
      });

      return session;
    } catch (error) {
      throw error;
    }
  });
