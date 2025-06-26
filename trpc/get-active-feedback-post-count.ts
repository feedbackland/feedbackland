import { publicProcedure } from "@/lib/trpc";
import { getPostCountQuery } from "@/queries/get-post-count";

export const getActiveFeedbackPostCount = publicProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      return await getPostCountQuery({
        orgId,
      });
    } catch (error) {
      throw error;
    }
  },
);
