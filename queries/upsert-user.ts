"server-only";

import { db } from "@/db/db";

export const upsertUserQuery = async ({
  userId,
  orgId,
  email,
  name,
  photoURL,
}: {
  userId: string;
  orgId: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
}) => {
  try {
    return await db.transaction().execute(async (trx) => {
      let user = await trx
        .selectFrom("user")
        .where("user.id", "=", userId)
        .selectAll()
        .executeTakeFirst();

      const userOrg = await trx
        .selectFrom("user_org")
        .where("user_org.userId", "=", userId)
        .where("user_org.orgId", "=", orgId)
        .selectAll()
        .executeTakeFirst();

      if (!user) {
        user = await trx
          .insertInto("user")
          .values({
            id: userId,
            email,
            name,
            photoURL,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      if (!userOrg) {
        await trx
          .insertInto("user_org")
          .values({
            userId,
            orgId,
            role: "user",
          })
          .executeTakeFirstOrThrow();
      }

      return user;
    });
  } catch (error: any) {
    console.log("error", error);
    throw error;
  }
};
