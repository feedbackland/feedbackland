import "server-only";
import { z } from "zod/v4";
import { headers } from "next/headers";
import { adminProcedure } from "@/lib/trpc";
import { createAdminInviteQuery } from "@/queries/create-admin-invite";
import { getAppUrl } from "@/lib/app-url";
export const createAdminInvite = adminProcedure
  .input(z.object({ email: z.email() }))
  .mutation(async ({ input, ctx }) => {
    const invite = await createAdminInviteQuery({
      ...input,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    });
    const url = new URL(getAppUrl(await headers()).appUrl);
    url.searchParams.set("admin-invite-token", invite.token);
    url.searchParams.set("admin-invite-email", input.email);
    return { success: true, inviteLink: url.toString() };
  });
