"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";

export async function getAdminsQuery({ orgId }: { orgId: string }) {
  try {
    const adminUsersCTE = db
      .selectFrom("user")
      .innerJoin("user_org", "user.id", "user_org.userId")
      .innerJoin("org", "user_org.orgId", "org.id")
      .select([
        "user.email",
        sql<"admin" | "invited">`'admin'`.as("status"),
        "user.createdAt",
      ])
      .where("org.id", "=", orgId)
      .where("user_org.role", "=", "admin");

    const adminInvitesCTE = db
      .selectFrom("admin_invites")
      .select([
        "admin_invites.email",
        sql<"admin" | "invited">`'invited'`.as("status"),
        "admin_invites.createdAt",
      ])
      .where("admin_invites.orgId", "=", orgId);

    const results = await db
      .selectFrom(adminUsersCTE.unionAll(adminInvitesCTE).as("admins"))
      .selectAll()
      .orderBy("admins.createdAt", "desc")
      .execute();

    return results;
  } catch (error) {
    throw error;
  }
}
