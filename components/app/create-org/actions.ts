"use server";

import { actionClient } from "@/lib/safe-action";
import { createOrgQuery } from "@/queries/create-org";
import { createOrgSchema } from "./validations";

export const createOrgAction = actionClient
  .inputSchema(createOrgSchema)
  .action(async ({ parsedInput: { orgSubdomain } }) => {
    try {
      const org = await createOrgQuery({ orgSubdomain });
      return { success: true, org };
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
