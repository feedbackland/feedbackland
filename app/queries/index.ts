import "server-only";
import { db } from "@/app/db/db";

const getUserByEmail = async (email: string) => {
  const record = await db
    .selectFrom("users")
    .select(["users.email"])
    .where("email", "=", email)
    .executeTakeFirst();

  return record;
};
