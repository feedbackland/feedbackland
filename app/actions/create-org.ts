"use server";

import { z } from "zod";
import { actionClient } from "@/app/utils/server/safe-action";
import { createOrg } from "@/app/queries";

const schema = z.object({
  userEmail: z.string(),
  orgName: z.string(),
});

export const createOrgAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput: { userEmail, orgName } }) => {
    try {
      await createOrg({ userEmail, orgName });
      return { success: true, message: "User created successfully!" };
    } catch {
      return {
        success: false,
        message: "An error occured trying to create the org",
      };
    }
  });
