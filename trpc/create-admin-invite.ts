import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { createAdminInviteQuery } from "@/queries/create-admin-invite";
import { resend } from "@/lib/resend";
import { AdminInviteEmail } from "@/components/emails/admin-invite";

export const createAdminInvite = adminProcedure
  .input(
    z.object({
      platformUrl: z.string().min(1),
      invitedBy: z.string().min(1),
      email: z.string().email(),
    }),
  )
  .mutation(
    async ({ input: { platformUrl, invitedBy, email }, ctx: { orgId } }) => {
      try {
        const adminInvite = await createAdminInviteQuery({
          email,
          orgId,
        });

        await resend.emails.send({
          from: "Feedbackland <hello@feedbackland.com>",
          to: [email],
          subject: "Feedbackland - Admin invitation",
          react: AdminInviteEmail({
            invitedBy,
            inviteLink: `${platformUrl}?admin-invite-token=${adminInvite.token}`,
          }),
        });

        return adminInvite;
      } catch (error) {
        throw error;
      }
    },
  );
