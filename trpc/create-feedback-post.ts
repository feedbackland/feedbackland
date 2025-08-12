import { z } from "zod/v4";
import { publicProcedure } from "@/lib/trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";

export const createFeedbackPost = publicProcedure
  .input(
    z.object({
      description: z.string().trim().min(1).max(10000),
    }),
  )
  .mutation(async ({ input: { description }, ctx: { userId, orgId } }) => {
    try {
      return await createFeedbackPostQuery({
        description,
        authorId: userId,
        orgId,
      });
    } catch (error) {
      throw error;
    }
  });
