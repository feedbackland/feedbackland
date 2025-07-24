import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { setActivitiesSeenQuery } from "@/queries/set-activities-seen";

export const setActivitiesSeen = adminProcedure
  .input(
    z.object({
      itemIds: z.array(z.uuid()),
    }),
  )
  .mutation(async ({ input: { itemIds }, ctx: { userId } }) => {
    try {
      return await setActivitiesSeenQuery({
        userId,
        itemIds,
      });
    } catch (error) {
      throw error;
    }
  });
