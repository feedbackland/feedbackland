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

      if (userEmail) {
        const overlayWidgetCodeSnippet = getOverlayWidgetCodeSnippet({
          orgId,
          orgSubdomain: org.orgSubdomain,
        });

        const sender = process.env.RESEND_EMAIL_SENDER!;
        const isSelfHosted = getIsSelfHosted("server");
        const from = isSelfHosted ? `Feedbackland <${sender}>` : sender;

        await resend?.emails.send({
          from,
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
