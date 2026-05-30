import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedMetaDataQuery } from "@/queries/get-activity-feed-meta-data";
import { z } from "zod/v4";

export const getActivityFeedMetaData = adminProcedure
  .input(z.object({}))
  .query(async ({ ctx: { orgId, userId } }) => {
    try {
      const {
        totalUnseenCount,
        unseenIdeasPostCount,
        unseenIssuesPostCount,
        unseenGeneralFeedbackPostCount,
        unseenCommentCount,
      } = await getActivityFeedMetaDataQuery({
        orgId,
        userId,
      });

      return {
        totalUnseenCount,
        unseenIdeasPostCount,
        unseenIssuesPostCount,
        unseenGeneralFeedbackPostCount,
        unseenCommentCount,
      };
    } catch (error) {
      throw error;
    }
  });
