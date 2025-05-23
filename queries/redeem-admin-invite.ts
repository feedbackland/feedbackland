"server-only";

import { db } from "@/db/db";

export async function redeemAdminInviteQuery({
  adminInviteToken,
  userId,
  orgId,
}: {
  adminInviteToken: string;
  userId: string;
  orgId: string;
}) {
  try {
    return await db.transaction().execute(async (trx) => {
      const adminInvite = await trx
        .selectFrom("admin_invites")
        .where("token", "=", adminInviteToken)
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

        await trx
          .deleteFrom("admin_invites")
          .where("token", "=", adminInviteToken)
          .execute();

        return true;
      } else {
        throw new Error("Admin invite not found");
      }
    });
  } catch (error) {
    throw error;
  }
}
