"use server";

import { actionClient } from "@/lib/server/safe-action";
import { createFeedback } from "./queries";
import { createFeedbackSchema } from "./validations";
import { getSession } from "@/lib/server/utils";
import { getOrg } from "@/lib/queries";

export const createFeedbackAction = actionClient
  .schema(createFeedbackSchema)
  .action(async ({ parsedInput: { title, description } }) => {
    try {
      const session = await getSession();
      const org = await getOrg();
      const orgId = org?.id;
      const userId = session?.user?.id;

      if (userId && orgId) {
        const feedback = await createFeedback({
          title,
          description,
          userId,
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
