import "server-only";
import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { updateFeedbackPostQuery } from "@/queries/update-feedback-post";
import { enforceContentLimit } from "@/lib/rate-limit";
import { TRPCError } from "@trpc/server";
import { MAX_FEEDBACK_HTML_BYTES } from "@/lib/feedback-text";
export const updateFeedbackPost = userProcedure
  .input(
    z.object({
      postId: z.uuid(),
      title: z.string().trim().min(1).max(300),
      description: z.string().trim().min(1).max(MAX_FEEDBACK_HTML_BYTES),
      expectedRevision: z.string().regex(/^[1-9][0-9]*$/),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await enforceContentLimit("edit", ctx.userId)).allowed)
      throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
    return updateFeedbackPostQuery({
      ...input,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    });
  });
