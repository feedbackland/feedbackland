import "server-only";
import { DomainError } from "@/lib/domain-error";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/schema";
import { canAdministerSession } from "./session-policy";
export type Actor = { userId: string; sessionId?: string | null };
// Never accept a role/canAdminister flag from a request or caller. Re-read under
// the membership lock when a mutation depends on administrative authority.
async function actorRow(trx: Kysely<DB>, actor: Actor) {
  if (!actor.sessionId) return undefined;
  return trx
    .selectFrom("auth_session")
    .innerJoin("user", "user.id", "auth_session.userId")
    .where("auth_session.id", "=", actor.sessionId)
    .where("user.id", "=", actor.userId)
    .select([
      "auth_session.id",
      "auth_session.userId",
      "auth_session.createdAt",
      "auth_session.expiresAt",
      "auth_session.scope",
      "user.role",
      sql<Date>`clock_timestamp()`.as("now"),
    ])
    .executeTakeFirst();
}
export async function canAdminister(trx: Kysely<DB>, actor: Actor) {
  const row = await actorRow(trx, actor);
  return (
    !!row &&
    canAdministerSession(
      { user: { id: row.userId, role: row.role }, session: row },
      row.now.getTime(),
    )
  );
}
export async function authorizeContentWrite(trx: Kysely<DB>, actor: Actor) {
  const row = await actorRow(trx, actor);
  if (!row || row.expiresAt <= row.now)
    throw new DomainError("UNAUTHORIZED", "Sign in to continue");
  return canAdministerSession(
    { user: { id: row.userId, role: row.role }, session: row },
    row.now.getTime(),
  );
}
export async function requireAdmin(trx: Kysely<DB>, actor: Actor) {
  if (!(await canAdminister(trx, actor)))
    throw new DomainError(
      "FORBIDDEN",
      "Sign in again with a first-party administrator session",
    );
}
