import "server-only";

import { db } from "@/db/db";

export async function getAdminInviteQuery({
  adminInviteToken,
}: {
  adminInviteToken: string;
}) {
  try {
    const adminInvite = await db
      .selectFrom("admin_invites")
      .where("token", "=", adminInviteToken)
      .selectAll()
      .executeTakeFirst();

    if (!adminInvite) {
      throw new Error("Admin invite not found");
    }

    return adminInvite;
  } catch (error) {
    throw error;
  }
}
