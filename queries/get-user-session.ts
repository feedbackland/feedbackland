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
    return await db.transaction().execute(async (trx) => {
      const org = await trx
        .selectFrom("org")
        .where("org.id", "=", orgId)
        .selectAll()
        .executeTakeFirstOrThrow();

      const user = await trx
        .selectFrom("user")
        .where("user.id", "=", userId)
        .selectAll()
        .executeTakeFirstOrThrow();

      const userOrg = await trx
        .selectFrom("user_org")
        .where("user_org.userId", "=", userId)
        .where("user_org.orgId", "=", orgId)
        .selectAll()
        .executeTakeFirstOrThrow();

      return { user, userOrg, org };
    });
  } catch (error) {
    throw error;
  }
};
