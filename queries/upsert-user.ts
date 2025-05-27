"server-only";

import { db } from "@/db/db";
import { UpsertUser } from "@/lib/typings";

export const upsertUserQuery = async ({
  userId,
  orgSubdomain,
  email,
  name,
  photoURL,
}: UpsertUser) => {
  try {
    return await db.transaction().execute(async (trx) => {
      const org = await trx
        .selectFrom("org")
        .where("org.orgSubdomain", "=", orgSubdomain)
        .selectAll()
        .executeTakeFirst();

      if (!org) {
        throw new Error("Org not found");
      }

      const orgId = org.id;

      let user = await trx
        .selectFrom("user")
        .where("user.id", "=", userId)
        .selectAll()
        .executeTakeFirst();

      let userOrg = await trx
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
            email: email.toLowerCase(),
            name,
            photoURL,
          })
          .onConflict((oc) => oc.doNothing())
          .returningAll()
          .executeTakeFirst();
      }

      if (!userOrg) {
        userOrg = await trx
          .insertInto("user_org")
          .values({
            userId,
            orgId,
            role: "user",
          })
          .onConflict((oc) => oc.doNothing())
          .returningAll()
          .executeTakeFirst();
      }

      if (!user || !userOrg || !org) {
        throw new Error("Something went wrong");
      }

      return { user, userOrg, org };
    });
  } catch (error: any) {
    throw error;
  }
};
