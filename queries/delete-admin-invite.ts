import "server-only";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { requireAdmin, type Actor } from "@/lib/auth/authorization";
export async function deleteAdminInviteQuery(
  input: Actor & { adminInviteId: string },
) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, input);
    return trx
      .deleteFrom("admin_invites")
      .where("id", "=", input.adminInviteId)
      .returning("id")
      .executeTakeFirstOrThrow();
  });
}
