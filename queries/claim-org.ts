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
    return await db.transaction().execute(async (trx) => {
      const { isClaimed } = await trx
        .selectFrom("org")
        .select(["isClaimed"])
        .where("id", "=", orgId)
        .executeTakeFirstOrThrow();

      if (!isClaimed) {
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
          .returningAll()
          .execute();

        return await trx
          .updateTable("org")
          .set({ isClaimed: true })
          .where("id", "=", orgId)
          .where("isClaimed", "=", false)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Org already claimed");
      }
    });
  } catch (error) {
    throw error;
  }
}
