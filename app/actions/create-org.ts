"use server";

import { z } from "zod";
import { actionClient } from "@/app/utils/server/safe-action";
import { createOrg } from "@/app/queries";

const schema = z.object({
  name: z.string(),
});

export const createOrgAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput: { name } }) => {
    try {
      await createOrg({ name });
      return { success: true, message: "User created successfully!" };
    } catch {
      return {
        success: false,
        message: "An erro occured trying to create the org",
      };
    }
  });
