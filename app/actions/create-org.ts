"use server";

import { z } from "zod";
import { actionClient } from "@/app/utils/server/safe-action";
import { createOrg } from "@/app/queries";
import { subdomainRegex } from "@/app/utils/helpers";

const subdomainSchema = z
  .string()
  .min(1, { message: "Subdomain is required" })
  .max(63, { message: "Subdomain must be at most 63 characters" })
  .regex(subdomainRegex, {
    message:
      "Subdomain is invalid. It can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen or contain periods.",
  });

const schema = z.object({
  userId: z.string(),
  orgName: z.string(),
  orgSubdomain: subdomainSchema,
});

export const createOrgAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput: { userId, orgName, orgSubdomain } }) => {
    if (orgSubdomain.toLowerCase() !== "new") {
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
    }

    return {
      success: false,
      message: "Invalid subdomain name",
    };
  });
