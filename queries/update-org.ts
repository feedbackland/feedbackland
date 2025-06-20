"server-only";

import { db } from "@/db/db";
import { Org } from "@/db/schema";
import { Selectable } from "kysely";

export const updateOrgQuery = async ({
  orgId,
  userId,
  orgSubdomain = undefined,
  platformTitle = undefined,
  platformDescription = undefined,
}: {
  orgId: string;
  userId: string;
  orgSubdomain?: string;
  platformTitle?: string;
  platformDescription?: string | null;
}) => {
  try {
    return await db.transaction().execute(async (trx) => {
      const { role } = await trx
        .selectFrom("user_org")
        .select("role")
        .where("userId", "=", userId)
        .where("orgId", "=", orgId)
        .select("user_org.role")
        .executeTakeFirstOrThrow();

      if (role === "admin") {
        const updatedOrgProps = Object.fromEntries(
          Object.entries({
            orgSubdomain,
            platformTitle,
            platformDescription,
          } satisfies Partial<Selectable<Org>>).filter(
            ([_, value]) => value !== undefined,
          ),
        ) as Partial<Selectable<Org>>;

        return await trx
          .updateTable("org")
          .set(updatedOrgProps)
          .where("id", "=", orgId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Not authorized to update this post");
      }
    });
  } catch (error) {
    throw error;
  }
};
