import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedMetaDataQuery } from "@/queries/get-activity-feed-meta-data";
import { z } from "zod/v4";

export const getActivityFeedMetaData = adminProcedure
  .input(z.object({}))
  .query(async ({ ctx: { orgId, userId } }) => {
    try {
      const {
        totalUnseenCount,
        unseenFeatureRequestPostCount,
        unseenBugReportPostCount,
        unseenGeneralFeedbackPostCount,
        unseenCommentCount,
        totalFeatureRequestPostCount,
        totalBugReportPostCount,
        totalGeneralFeedbackPostCount,
        totalCommentCount,
      } = await getActivityFeedMetaDataQuery({
        orgId,
        userId,
      });

      return {
        totalUnseenCount,
        unseenFeatureRequestPostCount,
        unseenBugReportPostCount,
        unseenGeneralFeedbackPostCount,
        unseenCommentCount,
        totalFeatureRequestPostCount,
        totalBugReportPostCount,
        totalGeneralFeedbackPostCount,
        totalCommentCount,
      };
    } catch (error) {
      throw error;
    }
  });
