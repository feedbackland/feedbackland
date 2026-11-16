import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { updateFeedbackPostStatusQuery } from "@/queries/update-feedback-post-status";
import { feedbackStatusSchema } from "@/lib/schemas";

export const updateFeedbackPostStatus = adminProcedure
  .input(z.object({ postId: z.uuid(), status: feedbackStatusSchema }))
  .mutation(({ input, ctx: { userId, sessionId, signal } }) =>
    updateFeedbackPostStatusQuery({ ...input, userId, sessionId, signal }),
  );
