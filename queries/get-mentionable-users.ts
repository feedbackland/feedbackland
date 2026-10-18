import "server-only";

import { db } from "@/db/db";

export const getMentionableUsersQuery = async ({
  searchValue,
}: {
  searchValue: string;
}) => {
  try {
    if (!searchValue || searchValue.trim() === "") {
      return [];
    }

    const users = await db
      .selectFrom("user")
      .select(["user.id", "user.name"])
      .where("name", "ilike", `%${searchValue}%`)
      .limit(10)
      .execute();

    return users;
  } catch (error) {
    throw error;
  }
};
