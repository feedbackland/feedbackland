import { userProcedure } from "@/lib/trpc";
import { claimOrgQuery } from "@/queries/claim-org";
import { resend } from "@/lib/resend";
import { WelcomeEmail } from "@/components/emails/welcome";
import { getIsSelfHosted, getOverlayWidgetCodeSnippet } from "@/lib/utils";

export const claimOrg = userProcedure.mutation(
  async ({ ctx: { userId, userEmail, orgId } }) => {
    try {
      const org = await claimOrgQuery({
        userId,
        orgId,
      });

      const isSelfHosted = getIsSelfHosted("server");

      if (userEmail && !isSelfHosted) {
        const overlayWidgetCodeSnippet = getOverlayWidgetCodeSnippet({
          orgId,
          orgSubdomain: org.orgSubdomain,
        });

        await resend.emails.send({
          from: "Feedbackland <hello@feedbackland.com>",
          to: [userEmail],
          subject: "Your Feedbackland platform is ready!",
          react: WelcomeEmail({
            orgId,
            overlayWidgetCodeSnippet,
          }),
        });
      }

      return org;
    } catch (error) {
      throw error;
    }
  },
);
