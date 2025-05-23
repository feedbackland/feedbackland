"server-only";

import { db } from "@/db/db";

export async function redeemAdminInviteQuery({
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
        const adminInvite = await trx
          .selectFrom("admin_invites")
          .where("id", "=", adminInviteId)
          .where("orgId", "=", orgId)
          .selectAll()
          .executeTakeFirstOrThrow();

        if (adminInvite) {
          await trx
            .insertInto("user_org")
            .values({
              userId,
              orgId,
              role: "admin",
            })
            .onConflict((oc) =>
              oc.columns(["userId", "orgId"]).doUpdateSet({ role: "admin" }),
            )
            .execute();

          return await trx
            .deleteFrom("admin_invites")
            .where("id", "=", adminInviteId)
            .where("orgId", "=", orgId)
            .execute();
        } else {
          throw new Error("Admin invite not found");
        }
      } else {
        throw new Error("Not authorized to delete this comment");
      }
    });
  } catch (error) {
    throw error;
  }
}
