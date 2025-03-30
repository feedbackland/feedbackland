import { db } from "@/db/db";

export const getUserOrgRoleQuery = async ({
  userId,
  orgId,
}: {
  userId?: string | null;
  orgId: string;
}) => {
  try {
    if (!userId) {
      return null;
    }

    const userOrg = await db
      .selectFrom("user_org")
      .select("role")
      .where("userId", "=", userId)
      .where("orgId", "=", orgId)
      .executeTakeFirstOrThrow();

    return userOrg?.role || null;
  } catch (error) {
    console.error("Error fetching user org role:", error);
    throw new Error("Failed to fetch user role");
  }
};
