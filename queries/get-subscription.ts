"server-only";

import { db } from "@/db/db";

export const getSubscriptionQuery = async ({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) => {
  try {
    return await db.transaction().execute(async (trx) => {
      const { role } = await trx
        .selectFrom("user_org")
        .select("role")
        .where("userId", "=", userId)
        .where("orgId", "=", orgId)
        .executeTakeFirstOrThrow();

      if (role !== "admin") {
        throw new Error("Not authorized to read subscription");
      }

      return await trx
        .selectFrom("subscriptions")
        .where("orgId", "=", orgId)
        .selectAll()
        .executeTakeFirst();
    });
  } catch (error) {
    throw error;
  }
};
