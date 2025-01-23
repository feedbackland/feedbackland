"use server";

import { actionClient } from "@/lib/server/safe-action";
import { createOrg } from "./queries";
import { createOrgSchema } from "./validations";

export const createOrgAction = actionClient
  .schema(createOrgSchema)
  .action(async ({ parsedInput: { userId, orgName, orgSubdomain } }) => {
    try {
      await createOrg({ userId, orgName, orgSubdomain });
      return { success: true, message: "User created successfully!" };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error?.message
            : "An unknown error occured trying to create the org",
      };
    }
  });
