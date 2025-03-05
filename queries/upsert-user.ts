"server-only";

import { db } from "@/db/db";

export const upsertUserQuery = async ({
  id,
  email,
  name,
}: {
  id: string;
  email: string;
  name: string;
}) => {
  try {
    return await db.transaction().execute(async (trx) => {
      let user = await trx
        .selectFrom("user")
        .where("user.id", "=", id)
        .selectAll()
        .executeTakeFirst();

      if (!user) {
        user = await db
          .insertInto("user")
          .values({
            id,
            email,
            name,
          })
          .onConflict((oc) => oc.column("email").doNothing())
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      console.log("upsertUserQuery user", user);

      return user;
    });

    // const user = await db
    //   .insertInto("user")
    //   .values({
    //     id,
    //     email,
    //     name,
    //   })
    //   .onConflict((oc) => oc.column("email").doNothing())
    //   .returningAll()
    //   .executeTakeFirstOrThrow();

    // console.log("upsertUserQuery user", user);

    // return user;
  } catch (error: any) {
    throw error;
  }
};
