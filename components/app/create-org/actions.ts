"use server";

import { actionClient } from "@/lib/server/safe-action";
import { createOrgQuery } from "@/queries/create-org";
import { createOrgSchema } from "./validations";

export const createOrgAction = actionClient
  .schema(createOrgSchema)
  .action(async ({ parsedInput: { orgName, orgSubdomain } }) => {
    try {
      const org = await createOrgQuery({ orgName, orgSubdomain });
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
