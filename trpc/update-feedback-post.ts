import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { updateFeedbackPostQuery } from "@/queries/update-feedback-post";

export const updateFeedbackPost = adminProcedure
  .input(
    z.object({
      postId: z.string().uuid(),
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
    }),
  )
  .mutation(
    async ({ input: { postId, title, description }, ctx: { orgId } }) => {
      try {
        const updatedPost = await updateFeedbackPostQuery({
          postId,
          orgId,
          title,
          description,
        });

        return updatedPost;
      } catch (error) {
        throw error;
      }
    },
  );
