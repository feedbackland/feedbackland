import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import {
  uploadTransaction,
  type UploadDeadline,
} from "./images/upload-deadline";
import { db } from "../db/db";
import { runtimeState } from "./runtime-state";
export async function isSetupComplete(deadline?: UploadDeadline) {
  const state = runtimeState();
  if (state.setupComplete) return true;
  const read = (connection: Kysely<DB>) =>
    connection
      .selectFrom("settings")
      .select("setupCompletedAt")
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
  const settings = deadline
    ? await uploadTransaction(deadline, (trx, run) => run(() => read(trx)))
    : await read(db);
  if (settings.setupCompletedAt) state.setupComplete = true;
  return state.setupComplete === true;
}
