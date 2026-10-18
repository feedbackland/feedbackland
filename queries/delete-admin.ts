import "server-only";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { requireAdmin, type Actor } from "@/lib/auth/authorization";
export async function deleteAdminQuery(input: Actor & { adminId: string }) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, input);
    const admins = await trx
      .selectFrom("user")
      .select("id")
      .where("role", "=", "admin")
      .orderBy("id")
      .forUpdate()
      .execute();
    if (
      input.adminId === input.userId ||
      (admins.some((u) => u.id === input.adminId) && admins.length <= 1)
    )
      throw new Error("LAST_ADMIN");
    return trx
      .updateTable("user")
      .set({ role: "user" })
      .where("id", "=", input.adminId)
      .returning("id")
      .executeTakeFirstOrThrow();
  });
}
