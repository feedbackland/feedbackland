"use server";

import { actionClient } from "@/app/utils/server/safe-action";
import { createOrg, isOrgSubdomainAvailable } from "@/app/queries";
import { createOrgSchema } from "./create-org-validation";

export const createOrgAction = actionClient
  .schema(createOrgSchema)
  .action(async ({ parsedInput: { userId, orgName, orgSubdomain } }) => {
    try {
      await createOrg({ userId, orgName, orgSubdomain });
      return { success: true, message: "User created successfully!" };
    } catch {
      return {
        success: false,
        message: "An error occured trying to create the org",
      };
    }
  });

export const checkOrgSubdomainAvailability = actionClient
  .schema(createOrgSchema.pick({ orgSubdomain: true }))
  .action(async ({ parsedInput: { orgSubdomain } }) => {
    try {
      const isAvailable = await isOrgSubdomainAvailable({ orgSubdomain });
      return { isAvailable };
    } catch (error) {
      throw error;
    }
  });
