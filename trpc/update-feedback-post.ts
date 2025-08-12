import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { updateFeedbackPostQuery } from "@/queries/update-feedback-post";

export const updateFeedbackPost = userProcedure
  .input(
    z.object({
      postId: z.uuid(),
      title: z.string().trim().min(1).max(300),
      description: z.string().trim().min(1).max(10000),
    }),
  )
  .mutation(
    async ({
      input: { postId, title, description },
      ctx: { orgId, userId },
    }) => {
      try {
        const updatedPost = await updateFeedbackPostQuery({
          postId,
          orgId,
          userId,
          title,
          description,
        });

        return updatedPost;
      } catch (error) {
        throw error;
      }
    },
  );
