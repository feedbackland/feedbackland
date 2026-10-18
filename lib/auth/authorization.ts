import "server-only";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/schema";
export type Actor = { userId: string; sessionId?: string | null };
// Never accept a role/canAdminister flag from a request or caller. Re-read under
// the membership lock when a mutation depends on administrative authority.
export async function canAdminister(trx: Kysely<DB>, actor: Actor) {
  if (!actor.sessionId) return false;
  const row = await trx
    .selectFrom("auth_session")
    .innerJoin("user", "user.id", "auth_session.userId")
    .where("auth_session.id", "=", actor.sessionId)
    .where("user.id", "=", actor.userId)
    .where("user.role", "=", "admin")
    .where("auth_session.scope", "=", "first-party")
    .where("auth_session.expiresAt", ">", sql<Date>`clock_timestamp()`)
    .where(
      "auth_session.createdAt",
      ">",
      sql<Date>`clock_timestamp()-interval '7 days'`,
    )
    .select("user.id")
    .executeTakeFirst();
  return !!row;
}
export async function requireAdmin(trx: Kysely<DB>, actor: Actor) {
  if (!(await canAdminister(trx, actor))) throw new Error("UNAUTHORIZED");
}
