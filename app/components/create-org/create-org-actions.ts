"use server";

import { actionClient } from "@/app/utils/server/safe-action";
import {
  createOrg,
  isOrgNameAvailable,
  isOrgSubdomainAvailable,
} from "@/app/queries";
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

export const checkOrgNameAvailability = actionClient
  .schema(createOrgSchema.pick({ orgName: true }))
  .action(async ({ parsedInput: { orgName } }) => {
    try {
      const isAvailable = await isOrgNameAvailable({ orgName });
      const message = isAvailable ? "Name is available" : "Name already taken";
      return { isAvailable, message };
    } catch {
      return {
        isAvailable: false,
        message: "An error occured trying to check the name availability",
      };
    }
  });

export const checkOrgSubdomainAvailability = actionClient
  .schema(createOrgSchema.pick({ orgSubdomain: true }))
  .action(async ({ parsedInput: { orgSubdomain } }) => {
    try {
      const isAvailable = await isOrgSubdomainAvailable({ orgSubdomain });
      const message = isAvailable
        ? "Subdomain is available"
        : "Subdomain already taken";
      return { isAvailable, message };
    } catch {
      return {
        isAvailable: false,
        message: "An error occured trying to check the subdomain availability",
      };
    }
  });
