"use server";

import { z } from "zod";
import { actionClient } from "@/app/utils/server/safe-action";
import { createOrg } from "@/app/queries";

const schema = z.object({
  userId: z.string(),
  orgName: z.string(),
  orgSubdomain: z.string(),
});

export const createOrgAction = actionClient
  .schema(schema)
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
