"use server";

import { actionClient } from "@/app/utils/server/safe-action";
import { createOrg } from "@/app/queries";
import { createOrgSchema } from "./create-org-validation";

export const createOrgAction = actionClient
  .schema(createOrgSchema)
  .action(async ({ parsedInput: { userId, orgName, orgSubdomain } }) => {
    try {
      await createOrg({ userId, orgName, orgSubdomain });
      return { success: true, message: "User created successfully!" };
    } catch (error) {
      console.log("error", error);

      return {
        success: false,
        message: "An error occured trying to create the org",
      };
    }
  });
