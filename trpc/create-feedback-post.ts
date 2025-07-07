import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { processImagesInHTML } from "@/lib/utils-server";

export const createFeedbackPost = userProcedure
  .input(
    z.object({
      description: z.string().trim().min(1),
    }),
  )
  .mutation(async ({ input, ctx: { userId, orgId } }) => {
    try {
      const description = await processImagesInHTML(input.description);

      return await createFeedbackPostQuery({
        description,
        authorId: userId,
        orgId,
      });
    } catch (error) {
      throw error;
    }
  });
