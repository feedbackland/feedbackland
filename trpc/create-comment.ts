import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { createCommentQuery } from "@/queries/create-comment";
import { processImagesInHTML } from "@/lib/utils-server";

export const createComment = userProcedure
  .input(
    z.object({
      postId: z.string().uuid(),
      parentCommentId: z.string().uuid().nullable(),
      content: z.string().trim().min(1),
    }),
  )
  .mutation(async ({ input, ctx: { userId } }) => {
    const { postId, parentCommentId } = input;

    try {
      const content = await processImagesInHTML(input.content);

      return await createCommentQuery({
        content,
        authorId: userId,
        postId,
        parentCommentId,
      });
    } catch (error) {
      throw error;
    }
  });
