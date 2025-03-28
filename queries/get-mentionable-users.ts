"server-only";

import { db } from "@/db/db";

export const getMentionableUsersQuery = async ({
  orgId,
  searchValue,
}: {
  orgId: string;
  searchValue: string;
}) => {
  try {
    console.log("getMentionableUsersQuery orgId", orgId);
    console.log("getMentionableUsersQuery searchValue", searchValue);

    if (!searchValue || searchValue.trim() === "") {
      return [];
    }

    const users = await db
      .selectFrom("user")
      .innerJoin("user_org", "user_org.userId", "user.id")
      .select(["user.id", "user.name"])
      .where("user_org.orgId", "=", orgId)
      .where("name", "ilike", `%${searchValue}%`)
      .limit(10)
      .execute();

    console.log("getMentionableUsersQuery users", users);

    return users;
  } catch (error: any) {
    throw error;
  }
};
