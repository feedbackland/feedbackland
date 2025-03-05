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
    const user = await db
      .insertInto("user")
      .values({
        id,
        email,
        name,
      })
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirstOrThrow();

    console.log("upsertUserQuery user", user);

    return user;
  } catch (error: any) {
    throw error;
  }
};
