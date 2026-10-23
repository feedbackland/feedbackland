import "server-only";
import { db } from "@/db/db";
import { sql } from "kysely";
export async function getAdminsQuery() {
  const users = db
    .selectFrom("user")
    .where("role", "=", "admin")
    .select([
      sql<string | null>`"user"."id"`.as("userId"),
      sql<string | null>`null`.as("adminInviteId"),
      "email",
      sql<string | null>`"user"."name"`.as("name"),
      sql<"admin" | "invited">`'admin'`.as("status"),
      "createdAt",
    ]);
  const invites = db
    .selectFrom("admin_invites")
    .where("expiresAt", ">", new Date())
    .select([
      sql<string | null>`null`.as("userId"),
      "id as adminInviteId",
      "email",
      sql<string | null>`null`.as("name"),
      sql<"admin" | "invited">`'invited'`.as("status"),
      "createdAt",
    ]);
  return users.unionAll(invites).orderBy("createdAt", "desc").execute();
}
