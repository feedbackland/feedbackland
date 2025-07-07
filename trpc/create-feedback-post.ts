import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";

export const createFeedbackPost = userProcedure
  .input(
    z.object({
      description: z.string().trim().min(1),
    }),
  )
  .mutation(async ({ input: { description }, ctx: { userId, orgId } }) => {
    try {
      console.log("description2", description);

      return await createFeedbackPostQuery({
        description,
        authorId: userId,
        orgId,
      });
    } catch (error) {
      throw error;
    }
  });
