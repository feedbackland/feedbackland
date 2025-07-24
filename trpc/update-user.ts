import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { updateUserQuery } from "@/queries/update-user";

export const updateUser = userProcedure
  .input(
    z.object({
      name: z.string().min(1),
    }),
  )
  .mutation(async ({ input: { name }, ctx: { userId } }) => {
    try {
      return await updateUserQuery({
        userId,
        name,
      });
    } catch (error) {
      throw error;
    }
  });
