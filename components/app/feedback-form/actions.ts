"use server";

import { actionClient } from "@/lib/safe-action";
import { createFeedback } from "./queries";
import { z } from "zod";

const schema = z.object({
  authorId: z.string().trim().min(1),
  orgId: z.string().trim().min(1),
  title: z.string().trim().min(1, "Please provide a title"),
  description: z.string().trim().min(1, "Please provide a description"),
});

export const createFeedbackAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput: { authorId, orgId, title, description } }) => {
    try {
      const feedback = await createFeedback({
        title,
        description,
        authorId,
        orgId,
      });

      return { success: true, feedback };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unknown error occurred trying to save the feedback",
      };
    }
  });
