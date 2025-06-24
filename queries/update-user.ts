"server-only";

import { db } from "@/db/db";

export const updateUserQuery = async ({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) => {
  try {
    return await db
      .updateTable("user")
      .set({ name })
      .where("id", "=", userId)
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch (error) {
    throw error;
  }
};
