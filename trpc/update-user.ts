import "server-only";
import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { updateUserQuery } from "@/queries/update-user";

export const updateUser = userProcedure
  .input(
    z.strictObject({
      name: z.string().trim().min(1).max(100),
    }),
  )
  .mutation(async ({ input: { name }, ctx }) => {
    try {
      return await updateUserQuery({
        headers: ctx.headers ?? new Headers(),
        name,
      });
    } catch (error) {
      throw error;
    }
  });
