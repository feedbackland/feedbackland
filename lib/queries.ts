"server-only";

import { db } from "@/db/db";
import { getSubdomain } from "@/lib/server/utils";

export const getOrg = async () => {
  const orgSubdomain = await getSubdomain();

  return await db
    .selectFrom("org")
    .where("org.subdomain", "=", orgSubdomain)
    .select(["id", "name", "isClaimed"])
    .executeTakeFirst();
};

export const getIsAdmin = async ({
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
