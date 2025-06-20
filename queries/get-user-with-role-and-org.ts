"server-only";

import { db } from "@/db/db";

export const getUserWithRoleAndOrgQuery = async ({
  userId,
  orgSubdomain,
}: {
  userId: string;
  orgSubdomain: string;
}) => {
  try {
    const result = await db
      .selectFrom("user")
      .innerJoin("user_org", "user.id", "user_org.userId")
      .innerJoin("org", "user_org.orgId", "org.id")
      .select([
        "user.id as userId",
        "user.name as userName",
        "user.email as userEmail",
        "user.photoURL as userPhotoURL",
        "user.createdAt as userCreatedAt",
        "user.updatedAt as userUpdatedAt",
        "user_org.role as userRole",
        "org.id as orgId",
        "org.orgSubdomain",
        "org.isClaimed as orgIsClaimed",
        "org.createdAt as orgCreatedAt",
        "org.updatedAt as orgUpdatedAt",
      ])
      .where("user.id", "=", userId)
      .where("org.orgSubdomain", "=", orgSubdomain)
      .executeTakeFirstOrThrow();

    return result;
  } catch (error) {
    throw error;
  }
};
