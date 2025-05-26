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
        .where("userId", "=", userId)
        .where("orgId", "=", orgId)
        .selectAll()
        .executeTakeFirstOrThrow();

      if (role !== "admin") {
        throw new Error("Not allowed to create admin invite");
      }

      const existingInvite = await trx
        .selectFrom("admin_invites")
        .where("email", "=", email.toLowerCase())
        .where("orgId", "=", orgId)
        .selectAll()
        .executeTakeFirst();

      if (existingInvite) {
        throw new Error("Invite already exists");
      }

      const existingAdminUser = await trx
        .selectFrom("user")
        .innerJoin("user_org", "user.id", "user_org.userId")
        .selectAll()
        .where("user.email", "=", email.toLowerCase())
        .where("user_org.orgId", "=", orgId)
        .where("user_org.role", "=", "admin")
        .executeTakeFirst(); // Changed to executeTakeFirst()

      if (existingAdminUser) {
        throw new Error("A admin with this email already exists");
      }

      const adminInvite = await trx
        .insertInto("admin_invites")
        .values({
          email: email.toLowerCase(),
          orgId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return adminInvite;
    });
  } catch (error: any) {
    throw error;
  }
}
