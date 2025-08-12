import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { createCommentQuery } from "@/queries/create-comment";

export const createComment = userProcedure
  .input(
    z.object({
      postId: z.uuid(),
      parentCommentId: z.uuid().nullable(),
      content: z.string().trim().min(1).max(10000),
    }),
  )
  .mutation(
    async ({
      input: { postId, parentCommentId, content },
      ctx: { userId, orgId },
    }) => {
      try {
        return await createCommentQuery({
          orgId,
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
