"server-only";

import { db } from "@/db/db";

export const getIsAdminQuery = async ({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) => {
  try {
    const response = await db
      .selectFrom("user_org")
      .where("userId", "=", userId)
      .where("orgId", "=", orgId)
      .select(["role"])
      .executeTakeFirst();

    return response?.role === "admin";
  } catch {
    return false;
  }
};
