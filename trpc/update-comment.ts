import "server-only";
import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { updateCommentQuery } from "@/queries/update-comment";
import { enforceContentLimit } from "@/lib/rate-limit";
import { TRPCError } from "@trpc/server";
export const updateComment = userProcedure
  .input(
    z.object({
      commentId: z.uuid(),
      content: z.string().trim().min(1).max(10000),
      expectedRevision: z.string().regex(/^[1-9][0-9]*$/),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await enforceContentLimit("edit", ctx.userId)).allowed)
      throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
    return updateCommentQuery({
      ...input,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    });
  });
