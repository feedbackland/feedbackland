"server-only";

import { db } from "@/db/db";

export async function deleteAdminQuery({
  adminId,
  userId,
  orgId,
}: {
  adminId: string;
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

      if (role !== "admin" || userId === adminId) {
        throw new Error("Not authorized to delete admin");
      }

      return await trx
        .updateTable("user_org")
        .set({ role: "user" })
        .where("userId", "=", adminId)
        .where("orgId", "=", orgId)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  } catch (error) {
    throw error;
  }
}
