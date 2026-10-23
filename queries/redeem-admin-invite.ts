import "server-only";
import { DomainError } from "@/lib/domain-error";
import { sql } from "kysely";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import type { Actor } from "@/lib/auth/authorization";
export async function redeemAdminInviteQuery(
  input: Actor & { adminInviteToken: string },
) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    if (!input.sessionId) throw new DomainError("UNAUTHORIZED", "UNAUTHORIZED");
    const actor = await trx
      .selectFrom("auth_session")
      .innerJoin("user", "user.id", "auth_session.userId")
      .where("auth_session.id", "=", input.sessionId)
      .where("user.id", "=", input.userId)
      .where("auth_session.scope", "=", "first-party")
      .where("auth_session.expiresAt", ">", sql<Date>`clock_timestamp()`)
      .where(
        "auth_session.createdAt",
        ">",
        sql<Date>`clock_timestamp()-interval '7 days'`,
      )
      .select("user.email")
      .executeTakeFirst();
    if (!actor) throw new DomainError("UNAUTHORIZED", "UNAUTHORIZED");
    const invite = await trx
      .selectFrom("admin_invites")
      .select(["id", "email"])
      .where("token", "=", input.adminInviteToken)
      .where("expiresAt", ">", sql<Date>`clock_timestamp()`)
      .forUpdate()
      .executeTakeFirst();
    if (!invite) throw new DomainError("NOT_FOUND", "Admin invite not found");
    if (invite.email.toLowerCase() !== actor.email.toLowerCase())
      throw new DomainError("UNAUTHORIZED", "UNAUTHORIZED");
    await trx
      .updateTable("user")
      .set({ role: "admin" })
      .where("id", "=", input.userId)
      .execute();
    await trx.deleteFrom("admin_invites").where("id", "=", invite.id).execute();
    return true;
  });
}
