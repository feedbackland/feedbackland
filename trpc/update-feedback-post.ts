import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { updateFeedbackPostQuery } from "@/queries/update-feedback-post";

export const updateFeedbackPost = userProcedure
  .input(
    z.object({
      postId: z.string().uuid(),
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
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
