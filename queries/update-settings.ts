import "server-only";
import { DomainError } from "@/lib/domain-error";
import { sql } from "kysely";
import { db } from "../db/db";
import { lock, locks } from "../db/locks";
import { requireAdmin, type Actor } from "../lib/auth/authorization";
import { revision } from "../lib/revision";
export async function updateSettingsQuery(
  input: Actor & {
    expectedRevision: string;
    platformTitle?: string;
    platformDescription?: string | null;
    allowIndexing?: boolean;
  },
) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, input);
    const result = await trx
      .updateTable("settings")
      .set({
        ...(input.platformTitle !== undefined
          ? { platformTitle: input.platformTitle }
          : {}),
        ...(input.platformDescription !== undefined
          ? { platformDescription: input.platformDescription }
          : {}),
        ...(input.allowIndexing !== undefined
          ? { allowIndexing: input.allowIndexing }
          : {}),
        revision: sql`revision+1`,
        updatedAt: sql`clock_timestamp()`,
      })
      .where("id", "=", 1)
      .where("revision", "=", revision(input.expectedRevision))
      .returning("revision")
      .executeTakeFirst();
    if (!result) throw new DomainError("CONFLICT", "CONFLICT");
    return result;
  });
}
