import "server-only";
import { db } from "../db/db";
import { runtimeState } from "./runtime-state";
export async function isSetupComplete() {
  const state = runtimeState();
  if (state.setupComplete) return true;
  const settings = await db
    .selectFrom("settings")
    .select("setupCompletedAt")
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  if (settings.setupCompletedAt) state.setupComplete = true;
  return state.setupComplete === true;
}
