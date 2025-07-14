import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { createAdminInviteQuery } from "@/queries/create-admin-invite";
import { resend } from "@/lib/resend";
import { AdminInviteEmail } from "@/components/emails/admin-invite";
import { getAdminLimit } from "./get-admin-limit";

export const createAdminInvite = adminProcedure
  .input(
    z.object({
      platformUrl: z.string().min(1),
      invitedBy: z.string().min(1),
      email: z.string().email(),
    }),
  )
  .mutation(async (opts) => {
    try {
      const { limitReached } = await getAdminLimit(opts as any);

      if (limitReached) throw new Error("Admin limit reached");

      const {
        input: { platformUrl, invitedBy, email },
        ctx: { orgId, userId },
      } = opts;

      const adminInvite = await createAdminInviteQuery({
        email,
        orgId,
        userId,
      });

      await resend.emails.send({
        from: "Feedbackland <hello@feedbackland.com>",
        to: [email],
        subject: "Feedbackland - Admin invitation",
        react: AdminInviteEmail({
          invitedBy,
          inviteLink: `${platformUrl}?admin-invite-token=${adminInvite.token}&admin-invite-email=${email}`,
        }),
      });
    } catch (error) {
      throw error;
    }
  });
