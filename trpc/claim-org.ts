import { userProcedure } from "@/lib/trpc";
import { claimOrgQuery } from "@/queries/claim-org";
import { resend } from "@/lib/resend";
import { WelcomeEmail } from "@/components/emails/welcome";

export const claimOrg = userProcedure.mutation(
  async ({ ctx: { userId, userEmail, orgId } }) => {
    try {
      const org = await claimOrgQuery({
        userId,
        orgId,
      });

      if (userEmail) {
        await resend.emails.send({
          from: "Feedbackland <hello@feedbackland.com>",
          to: [userEmail],
          subject: "Your feedback platform is ready",
          react: WelcomeEmail({
            orgId,
          }),
        });
      }

      return org;
    } catch (error) {
      throw error;
    }
  },
);
