"server-only";

import { db } from "@/db/db";

export async function createAdminInviteQuery({
  email,
  orgId,
  userId,
}: {
  email: string;
  orgId: string;
  userId: string;
}) {
  try {
    return await db.transaction().execute(async (trx) => {
      const { role } = await trx
        .selectFrom("user_org")
        .select("role")
        .where("userId", "=", userId)
        .where("orgId", "=", orgId)
        .executeTakeFirstOrThrow();

      if (role === "admin") {
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
      } else {
        throw new Error("User is not an admin");
      }
    });
  } catch (error: any) {
    throw error;
  }
}
