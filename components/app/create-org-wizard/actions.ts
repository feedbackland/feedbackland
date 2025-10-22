"use server";

import { actionClient } from "@/lib/safe-action";
import { createOrgQuery } from "@/queries/create-org";
import { createOrgSchema } from "./validations";
import { claimOrgSchema } from "@/lib/schemas";
import { claimOrgQuery } from "@/queries/claim-org";
import { resend } from "@/lib/resend";
import { WelcomeEmail } from "@/components/emails/welcome";
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

      if (userEmail) {
        const overlayWidgetCodeSnippet = getOverlayWidgetCodeSnippet({
          orgId,
          orgSubdomain: org.orgSubdomain,
        });

        const sender = process.env.RESEND_EMAIL_SENDER!;
        const isSelfHosted = getIsSelfHosted("server");
        const vercelUrl = getVercelUrl();
        const from = !isSelfHosted ? `Feedbackland <${sender}>` : sender;
        const platformUrl = !isSelfHosted
          ? `https://${orgId}.feedbackland.com`
          : `${vercelUrl}/${org.orgSubdomain}`;

        await resend?.emails.send({
          from,
          to: [userEmail],
          subject: "Your Feedbackland platform is ready!",
          react: WelcomeEmail({
            orgId,
            overlayWidgetCodeSnippet,
            platformUrl,
          }),
        });
      }

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
