import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "../../db/schema";
import { sql } from "kysely";
import { db } from "../../db/db";
export async function ensureAiSettingsRow(trx: Kysely<DB>) {
  await trx
    .insertInto("ai_settings")
    .values({ id: 1 })
    .onConflict((conflict) => conflict.column("id").doNothing())
    .execute();
}
export async function sweepHealth() {
  let count: number;
  do {
    count = await db.transaction().execute(async (trx) => {
      await sql`set local statement_timeout='5s'`.execute(trx);
      const acquired = await sql<{
        ok: boolean;
      }>`select pg_try_advisory_xact_lock(4702111234474983746) as ok`.execute(
        trx,
      );
      if (!acquired.rows[0].ok) return 0;
      return (
        await sql`delete from ai_health where ctid in (select ctid from ai_health where "updatedAt"<now()-interval '24 hours' and "configToken" is distinct from (select "effectiveConfigToken" from ai_settings where id=1) limit 1000 for update skip locked) returning 1`.execute(
          trx,
        )
      ).rows.length;
    });
  } while (count === 1000);
}
