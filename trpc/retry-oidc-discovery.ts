import "server-only";
import { sql } from "kysely";
import { db } from "../db/db";
import { lock, locks } from "../db/locks";
import { adminProcedure } from "../lib/trpc";
import { requireAdmin } from "../lib/auth/authorization";
import { synchronizeAuthProviders, authStatus } from "../lib/auth/discovery";
export const retryOidcDiscovery = adminProcedure.mutation(async ({ ctx }) => {
  await db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, { userId: ctx.userId, sessionId: ctx.sessionId });
    await trx
      .updateTable("auth_runtime")
      .set({ discoveryEpoch: sql`"discoveryEpoch"+1` })
      .where("id", "=", 1)
      .execute();
  });
  await synchronizeAuthProviders(true);
  return authStatus();
});
