import "server-only";
import { z } from "zod/v4";
import { DomainError } from "@/lib/domain-error";
import { MAX_FEEDBACK_TEXT_LENGTH } from "@/lib/feedback-text";
import { improveDraft } from "@/lib/llm/content";
import { enforceRewriteLimit } from "@/lib/rate-limit";
import { publicProcedure } from "@/lib/trpc";

export const rewriteFeedback = publicProcedure
  .input(
    z.object({
      description: z.string().trim().min(1).max(MAX_FEEDBACK_TEXT_LENGTH),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!(await enforceRewriteLimit(ctx.ip)).allowed)
      throw new DomainError("TOO_MANY_REQUESTS", "RATE_LIMITED");
    return improveDraft(input.description, ctx.signal);
  });
