"server-only";

import { db } from "@/db/db";
import { UpsertUser } from "@/lib/typings";

export const upsertUserQuery = async (args: UpsertUser) => {
  try {
    const { userId, orgSubdomain, name, photoURL } = args;
    const email = args.email.toLowerCase();

    return await db.transaction().execute(async (trx) => {
      const org = await trx
        .selectFrom("org")
        .where("org.orgSubdomain", "=", orgSubdomain)
        .selectAll()
        .executeTakeFirstOrThrow();

      const orgId = org.id;

      let user = await trx
        .selectFrom("user")
        .where("user.id", "=", userId)
        .selectAll()
        .executeTakeFirst();

      if (!user || !!(user && !user.name && name)) {
        user = await trx
          .insertInto("user")
          .values({
            id: userId,
            email,
            name,
            photoURL,
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              name,
            }),
          )
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      let userOrg = await trx
        .selectFrom("user_org")
        .where("user_org.userId", "=", userId)
        .where("user_org.orgId", "=", orgId)
        .selectAll()
        .executeTakeFirst();

      if (!userOrg) {
        userOrg = await trx
          .insertInto("user_org")
          .values({
            userId,
            orgId,
            role: "user",
          })
          .onConflict((oc) =>
            oc.columns(["userId", "orgId"]).doUpdateSet({
              orgId,
            }),
          )
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      return { user, userOrg, org };
    });
  } catch (error) {
    throw error;
  }
};
