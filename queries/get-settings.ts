import "server-only";
import { db } from "../db/db";
export const SETTINGS_FIELDS = [
  "platformTitle",
  "platformDescription",
  "logoImageId",
  "allowIndexing",
  "setupCompletedAt",
  "revision",
] as const;
export function getSettingsQuery() {
  return db
    .selectFrom("settings")
    .select(SETTINGS_FIELDS)
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
}
