import "server-only";
import { adminProcedure } from "@/lib/trpc";
import { setAllActivitiesSeenQuery } from "@/queries/set-all-activities-seen";

export const setAllActivitiesSeen = adminProcedure.mutation(
  async ({ ctx: { userId } }) => {
    try {
      return await setAllActivitiesSeenQuery({
        userId,
      });
    } catch (error) {
      throw error;
    }
  },
);
