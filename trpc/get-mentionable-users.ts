import { z } from "zod";
import { publicProcedure } from "@/lib/trpc";
import { getMentionableUsersQuery } from "@/queries/get-mentionable-users";

export const getMentionableUsers = publicProcedure
  .input(
    z.object({
      searchValue: z.string(),
    }),
  )
  .query(async ({ input: { searchValue }, ctx: { orgId } }) => {
    try {
      const users = await getMentionableUsersQuery({
        orgId,
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
