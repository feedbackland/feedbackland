"server-only";

import { db } from "@/db/db";

export async function deleteAdminInviteQuery({
  adminInviteId,
  userId,
  orgId,
}: {
  adminInviteId: string;
  userId: string;
  orgId: string;
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
        return await trx
          .deleteFrom("admin_invites")
          .where("id", "=", adminInviteId)
          .where("orgId", "=", orgId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Not authorized to delete this admin invite");
      }
    });
  } catch (error) {
    throw error;
  }
}
