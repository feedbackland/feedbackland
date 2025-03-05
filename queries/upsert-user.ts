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
    return await db
      .insertInto("user")
      .values({
        id,
        email,
        name,
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch (error: any) {
    throw error;
  }
};
