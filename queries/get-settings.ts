import "server-only";
import { db } from "../db/db";
export function getSettingsQuery() {
  return db
    .selectFrom("settings")
    .select([
      "platformTitle",
      "platformDescription",
      "logoImageId",
      "allowIndexing",
      "setupCompletedAt",
      "revision",
    ])
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
}
