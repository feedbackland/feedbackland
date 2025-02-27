"use server";

import { actionClient } from "@/lib/server/safe-action";
import { createFeedback } from "./queries";
import { createFeedbackSchema } from "./validations";
import { getSession } from "@/lib/auth/session";
import { getOrg } from "@/lib/queries";

export const createFeedbackAction = actionClient
  .schema(createFeedbackSchema)
  .action(async ({ parsedInput: { title, description } }) => {
    try {
      const session = await getSession();
      const org = await getOrg();
      const orgId = org?.id;
      const authorId = session?.uid;

      if (authorId && orgId) {
        const feedback = await createFeedback({
          title,
          description,
          authorId,
          orgId,
        });

        return { success: true, feedback };
      }

      return { success: false, message: "Unauthorized" };
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
