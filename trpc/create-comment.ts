import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { createCommentQuery } from "@/queries/create-comment";

export const createComment = userProcedure
  .input(
    z.object({
      postId: z.string().uuid(),
      parentCommentId: z.string().uuid().nullable(),
      content: z.string().trim().min(1),
    }),
  )
  .mutation(
    async ({
      input: { postId, parentCommentId, content },
      ctx: { userId },
    }) => {
      try {
        return await createCommentQuery({
          content,
          authorId: userId,
          postId,
          parentCommentId,
        });
      } catch (error) {
        throw error;
      }
    },
  );
