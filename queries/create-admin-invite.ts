import "server-only";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { requireAdmin, type Actor } from "@/lib/auth/authorization";
export async function createAdminInviteQuery(input: Actor & { email: string }) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, input);
    const email = input.email.trim().toLowerCase();
    const existing = await trx
      .selectFrom("admin_invites")
      .select("id")
      .where("email", "=", email)
      .where("expiresAt", ">", new Date())
      .executeTakeFirst();
    if (existing) throw new Error("INVITE_EXISTS");
    return trx
      .insertInto("admin_invites")
      .values({ email })
      .returningAll()
      .executeTakeFirstOrThrow();
  });
}
