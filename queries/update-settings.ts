import "server-only";
import { DomainError } from "@/lib/domain-error";
import { sql } from "kysely";
import { validateImages, trimDetached } from "../lib/images/store";
import { db } from "../db/db";
import { lock, locks } from "../db/locks";
import { requireAdmin, type Actor } from "../lib/auth/authorization";
import { revision } from "../lib/revision";
import { SETTINGS_FIELDS } from "./get-settings";
export async function updateSettingsQuery(
  input: Actor & {
    expectedRevision: string;
    platformTitle?: string;
    platformDescription?: string | null;
    allowIndexing?: boolean;
    logoImageId?: string | null;
  },
) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, input);
    let prior: string | null = null;
    if (input.logoImageId !== undefined) {
      await lock(trx, locks.images);
      prior = (
        await trx
          .selectFrom("settings")
          .select("logoImageId")
          .where("id", "=", 1)
          .forUpdate()
          .executeTakeFirstOrThrow()
      ).logoImageId;
      if (input.logoImageId) await validateImages(trx, [input.logoImageId]);
    }
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
        ...(input.logoImageId !== undefined
          ? { logoImageId: input.logoImageId }
          : {}),
        revision: sql`revision+1`,
        updatedAt: sql`clock_timestamp()`,
      })
      .where("id", "=", 1)
      .where("revision", "=", revision(input.expectedRevision))
      .returning(SETTINGS_FIELDS)
      .executeTakeFirst();
    if (!result) throw new DomainError("CONFLICT", "CONFLICT");
    if (prior && prior !== input.logoImageId) await trimDetached(trx, [prior]);
    return result;
  });
}
