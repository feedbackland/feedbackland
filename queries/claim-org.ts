"server-only";

import { db } from "@/db/db";

export async function claimOrgQuery({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) {
  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("user_org")
        .values({
          userId,
          orgId,
          role: "admin",
        })
        .onConflict(
          (oc) =>
            oc
              .columns(["userId", "orgId"]) // Specify the columns causing the conflict
              .doUpdateSet({ role: "admin" }), // Update the role if conflict occurs
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("org")
        .set({ isClaimed: true })
        .where("id", "=", orgId)
        .executeTakeFirstOrThrow();
    });

    return true;
  } catch (error: any) {
    throw error;
  }
}
