import "server-only";
import { db } from "@/app/db/db";

export const getUserByEmail = async (email: string) => {
  const record = await db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", email)
    .executeTakeFirst();

  return record;
};
