"server-only";

import { db } from "@/db/db";

export async function createAdminInviteQuery({
  email,
  orgId,
}: {
  email: string;
  orgId: string;
}) {
  try {
    return await db.transaction().execute(async (trx) => {
      const existingInvite = await trx
        .selectFrom("admin_invites")
        .where("email", "=", email.toLowerCase())
        .where("orgId", "=", orgId)
        .selectAll()
        .executeTakeFirstOrThrow();

      if (!existingInvite) {
        const adminInvite = await db
          .insertInto("admin_invites")
          .values({
            email: email.toLowerCase(),
            orgId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return adminInvite;
      } else {
        throw new Error("Invite already exists");
      }
    });
  } catch (error: any) {
    throw error;
  }
}
