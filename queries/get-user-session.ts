"server-only";

import { db } from "@/db/db";

export const getUserSessionQuery = async ({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string;
}) => {
  try {
    const result = await db
      .selectFrom("user_org")
      .innerJoin("user", "user.id", "user_org.userId")
      .innerJoin("org", "org.id", "user_org.orgId")
      .where("org.id", "=", orgId)
      .where("user_org.userId", "=", userId)
      .select([
        "user_org.orgId as userOrg_orgId",
        "user_org.userId as userOrg_userId",
        "user_org.role as userOrg_role",
        "user.id as user_id",
        "user.createdAt as user_createdAt",
        "user.email as user_email",
        "user.name as user_name",
        "user.photoURL as user_photoURL",
        "user.updatedAt as user_updatedAt",
        "org.id as org_id",
        "org.createdAt as org_createdAt",
        "org.isClaimed as org_isClaimed",
        "org.orgSubdomain as org_orgSubdomain",
        "org.platformDescription as org_platformDescription",
        "org.platformTitle as org_platformTitle",
        "org.updatedAt as org_updatedAt",
      ])
      .executeTakeFirstOrThrow();

    const user = {
      id: result.user_id,
      createdAt: result.user_createdAt,
      email: result.user_email,
      name: result.user_name,
      photoURL: result.user_photoURL,
      updatedAt: result.user_updatedAt,
    };

    const org = {
      id: result.org_id,
      createdAt: result.org_createdAt,
      isClaimed: result.org_isClaimed,
      orgSubdomain: result.org_orgSubdomain,
      platformDescription: result.org_platformDescription,
      platformTitle: result.org_platformTitle,
      updatedAt: result.org_updatedAt,
    };

    const userOrg = {
      orgId: result.userOrg_orgId,
      userId: result.userOrg_userId,
      role: result.userOrg_role,
    };

    return { user, userOrg, org };
  } catch (error) {
    throw error;
  }
};
