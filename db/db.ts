import "server-only";
import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { DB } from "./schema";
import { getConfig } from "../lib/config";
import { runtimeState } from "../lib/runtime-state";
import { log, sqlstate } from "../lib/log";
import { lazyDelegate } from "../lib/lazy-delegate";
export function getPool(maintenance = false): Pool {
  const state = runtimeState();
  const field = maintenance ? "maintenancePool" : "pool";
  if (!state[field]) {
    const config = getConfig();
    const pool = new Pool({
      ...config.database(),
      max: maintenance ? 1 : config.poolMax - 1,
      ...(maintenance
        ? { connectionTimeoutMillis: 5000, query_timeout: 5000 }
        : {}),
      application_name: maintenance
        ? "feedbackland-maintenance"
        : "feedbackland-app",
    });
    pool.on("error", (error) =>
      log("database.idle-error", { sqlstate: sqlstate(error) }, "warn"),
    );
    state[field] = pool;
  }
  return state[field];
}
export function getDb(): Kysely<DB> {
  return (runtimeState().db ??= new Kysely<DB>({
    dialect: new PostgresDialect({ pool: getPool() }),
  }));
}
// Property access, not import, acquires the globally shared instance.
export const db = lazyDelegate(getDb);
