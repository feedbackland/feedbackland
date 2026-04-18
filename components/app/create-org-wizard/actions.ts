"use server";

import { actionClient } from "@/lib/safe-action";
import { createOrgQuery } from "@/queries/create-org";
import { createOrgSchema } from "./validations";
import { claimOrgSchema } from "@/lib/schemas";
import { claimOrgQuery } from "@/queries/claim-org";
import {
  getIsSelfHosted,
  getOverlayWidgetCodeSnippet,
  getVercelUrl,
} from "@/lib/utils";

export const createOrgAction = actionClient
  .inputSchema(createOrgSchema)
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

export const claimOrgAction = actionClient
  .inputSchema(claimOrgSchema)
  .action(async ({ parsedInput: { userId, userEmail, orgId } }) => {
    try {
      const org = await claimOrgQuery({ userId, orgId });

      return { success: true, org };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error?.message
            : "An unknown error occured trying to claim the org",
      };
    }
  });
