import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { searchActivityFeedQuery } from "@/queries/search-activity-feed";

export const searchActivityFeed = adminProcedure
  .input(
    z.object({
      searchValue: z.string().trim(),
    }),
  )
  .query(async ({ input: { searchValue }, ctx: { orgId } }) => {
    try {
      return await searchActivityFeedQuery({
        orgId,
        searchValue,
      });
    } catch (error) {
      throw error;
    }
  });
