import "server-only";
import { enforceContentLimit } from "@/lib/rate-limit";
import { TRPCError } from "@trpc/server";
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
      ctx: { userId, sessionId, signal },
    }) => {
      if (!(await enforceContentLimit("commentCreate", userId)).allowed)
        throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
      return await createCommentQuery({
        content,
        authorId: userId,
        sessionId,
        signal,
        postId,
        parentCommentId,
      });
    },
  );
