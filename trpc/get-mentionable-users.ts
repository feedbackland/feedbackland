import "server-only";
import { z } from "zod/v4";
import { publicProcedure } from "@/lib/trpc";
import { getMentionableUsersQuery } from "@/queries/get-mentionable-users";

export const getMentionableUsers = publicProcedure
  .input(
    z.object({
      searchValue: z.string(),
    }),
  )
  .query(async ({ input: { searchValue }, ctx: {} }) => {
    try {
      const users = await getMentionableUsersQuery({
        searchValue,
      });

      return users
        .filter(({ name }) => name && name.length > 0)
        .map(({ id, name }) => ({
          id,
          name,
        })) as [{ id: string; name: string }];
    } catch (error) {
      throw error;
    }
  });
