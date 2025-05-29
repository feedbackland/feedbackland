import { adminProcedure } from "@/lib/trpc";
import { setAllActivitiesSeenQuery } from "@/queries/set-all-activities-seen";

export const setAllActivitiesSeen = adminProcedure.mutation(
  async ({ ctx: { userId, orgId } }) => {
    try {
      return await setAllActivitiesSeenQuery({
        userId,
        orgId,
      });
    } catch (error) {
      throw error;
    }
  },
);
