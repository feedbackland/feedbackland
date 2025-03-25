"server-only";

import { db } from "@/db/db";

export const upsertUserQuery = async ({
  id,
  email,
  name,
  photoURL,
}: {
  id: string;
  email: string;
  name: string | null;
  photoURL: string | null;
}) => {
  try {
    return await db.transaction().execute(async (trx) => {
      let user = await trx
        .selectFrom("user")
        .where("user.id", "=", id)
        .selectAll()
        .executeTakeFirst();

      if (!user) {
        user = await trx
          .insertInto("user")
          .values({
            id,
            email,
            name,
            photoURL,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      return user;
    });
  } catch (error: any) {
    throw error;
  }
};
