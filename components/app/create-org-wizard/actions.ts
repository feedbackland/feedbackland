"use server";

import { actionClient } from "@/lib/safe-action";
import { createOrgQuery } from "@/queries/create-org";
import { hasClaimedOrgQuery } from "@/queries/has-claimed-org";
import { createOrgSchema } from "./validations";
import { claimOrgSchema } from "@/lib/schemas";
import { claimOrgQuery } from "@/queries/claim-org";
import { adminAuth } from "@/lib/firebase/admin";
import { getIsSelfHosted } from "@/lib/utils";

export const createOrgAction = actionClient
  .inputSchema(createOrgSchema)
  .action(async ({ parsedInput: { orgName, orgSubdomain } }) => {
    try {
      // On a self-hosted instance /get-started is a one-time setup step, not a
      // public signup funnel. Once the operator has claimed a board, close the
      // door — otherwise anyone who finds the URL can create orgs (and their
      // seed rows) without limit. The hosted service keeps the funnel open.
      if (getIsSelfHosted("server") && (await hasClaimedOrgQuery())) {
        return {
          success: false,
          message: "Organization creation is disabled on this instance.",
        };
      }

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
  .action(async ({ parsedInput: { idToken, orgId } }) => {
    try {
      // Verify the token server-side and take the uid from it. A client could
      // otherwise claim any unclaimed org as any user id it liked, granting
      // itself (or someone else) admin.
      const { uid } = await adminAuth.verifyIdToken(idToken);

      const org = await claimOrgQuery({ userId: uid, orgId });

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
