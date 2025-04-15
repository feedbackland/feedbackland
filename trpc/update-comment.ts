import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { updateCommentQuery } from "@/queries/update-comment";

export const updateComment = userProcedure
  .input(
    z.object({
      commentId: z.string().uuid(),
      content: z.string().trim().min(1),
    }),
  )
  .mutation(
    async ({ input: { commentId, content }, ctx: { orgId, userId } }) => {
      try {
        return await updateCommentQuery({
          commentId,
          orgId,
          userId,
          content,
        });
      } catch (error) {
        throw error;
      }
    },
  );
