import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { createCommentQuery } from "@/queries/create-comment";

export const createComment = userProcedure
  .input(
    z.object({
      postId: z.uuid(),
      parentCommentId: z.uuid().nullable(),
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
