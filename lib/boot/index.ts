import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Client } from "pg";
import {
  Kysely,
  PostgresAdapter,
  PostgresDialect,
  sql,
  type Transaction,
} from "kysely";
import { Migrator, type Migration } from "kysely/migration";
import type { DB } from "../../db/schema";
import { getPool } from "../../db/db";
import { locks, lock } from "../../db/locks";
import { migrations } from "../../db/migrations";
import { discoverVector } from "../../db/vector";
import { getConfig, neutraliseAuthEnv, validateCode } from "../config";
import { runtimeState } from "../runtime-state";
import { log, sqlstate } from "../log";
import { ensureAiSettingsRow } from "../llm/settings-store";
import identity from "../build-identity.json";
import { BootError } from "./errors";

export class BootAdapter extends PostgresAdapter {
  async acquireMigrationLock() {}
  async releaseMigrationLock() {}
}
export class BootDialect extends PostgresDialect {
  createAdapter() {
    return new BootAdapter();
  }
}
async function waitForDatabase() {
  const options = getConfig().database();
  const endpoint = new URL(options.connectionString!);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const timeout = Math.max(1, Math.min(5000, deadline - Date.now()));
    const client = new Client({
      ...options,
      connectionTimeoutMillis: timeout,
      query_timeout: timeout,
    });
    client.on("error", () => {});
    try {
      await client.connect();
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const query = {
        text: "select 1",
        query_timeout: Math.min(5000, remaining),
      };
      await client.query(query);
      return;
    } catch {
      log("database.waiting", {
        host: endpoint.hostname,
        port: endpoint.port || "5432",
      });
    } finally {
      await client.end().catch(() => {});
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(2000, Math.max(0, deadline - Date.now()))),
    );
  }
  throw new BootError(
    "database-wait",
    "Database did not become reachable within 90 seconds",
  );
}

/** Exported for the isolated failure/pooler harness; no runtime fixture switch. */
export async function migrateAndSeed(
  registry: Record<string, Migration> = migrations,
) {
  const config = getConfig();
  const state = runtimeState();
  const bootDb = new Kysely<DB>({
    dialect: new BootDialect({ pool: getPool() }),
  });
  try {
    return await bootDb.transaction().execute(async (trx) => {
      await sql`set local lock_timeout = '15min'`.execute(trx);
      await sql`set local statement_timeout = 0`.execute(trx);
      const attempt = await sql<{
        acquired: boolean;
      }>`select pg_try_advisory_xact_lock(${locks.boot.toString()}::bigint) as acquired`.execute(
        trx,
      );
      if (!attempt.rows[0].acquired) {
        log("boot.waiting-for-migration");
        const timer = setInterval(
          () => log("boot.waiting-for-migration"),
          30_000,
        );
        timer.unref();
        try {
          await lock(trx, locks.boot);
        } finally {
          clearInterval(timer);
        }
      }
      await sql`set local lock_timeout = '30s'`.execute(trx);
      const metadata = await discoverVector(trx, config.dimensions);
      // Migrations need the observed type, before requests can run. Cleared on
      // rollback; the boot promise gates every Next request until publication.
      state.vector = metadata;
      const schemaResult = await sql<{
        schema: string;
      }>`select current_schema() as schema`.execute(trx);
      const schema = schemaResult.rows[0].schema;
      const tracking = await sql<{
        exists: boolean;
      }>`select to_regclass(quote_ident(current_schema()) || '.kysely_migration') is not null as exists`.execute(
        trx,
      );
      const applied = tracking.rows[0].exists
        ? (
            await sql<{
              name: string;
            }>`select name from ${sql.id(schema, "kysely_migration")}`.execute(
              trx,
            )
          ).rows
        : [];
      if (!tracking.rows[0].exists) {
        const existing = await sql<{
          count: number;
        }>`select count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=current_schema() and c.relkind in ('r','p','v','m') and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')`.execute(
          trx,
        );
        if (existing.rows[0].count)
          throw new BootError(
            "unexpected-schema",
            "This database has an unrecognized existing schema; use a fresh disposable database for this pre-release milestone.",
          );
      }
      const unknown = applied.filter(
        (row) => !Object.hasOwn(registry, row.name),
      );
      if (unknown.length)
        log(
          "boot.database-newer-than-image",
          { count: unknown.length },
          "warn",
        );
      else {
        const migrator = new Migrator({
          db: trx,
          migrationTableSchema: schema,
          provider: { getMigrations: async () => registry },
        });
        const result = await migrator.migrateToLatest();
        if (result.error) {
          log(
            "boot.migration-failed",
            {
              name: result.results?.find((row) => row.status === "Error")
                ?.migrationName,
              sqlstate: sqlstate(result.error),
            },
            "error",
          );
          throw result.error;
        }
        log("boot.migrations-complete", { count: result.results?.length ?? 0 });
      }
      const columns = await sql<{
        dimensions: number;
        kind: string;
      }>`select a.atttypmod as dimensions,t.typname as kind from pg_attribute a join pg_type t on t.oid=a.atttypid where a.attrelid in ('feedback'::regclass,'comment'::regclass) and a.attname='embedding'`.execute(
        trx,
      );
      if (
        columns.rows.length !== 2 ||
        columns.rows.some(
          (row) =>
            !["vector", "halfvec"].includes(row.kind) ||
            row.dimensions < 1 ||
            row.dimensions > 4000,
        ) ||
        columns.rows.some(
          (row) =>
            row.dimensions !== columns.rows[0].dimensions ||
            row.kind !== columns.rows[0].kind,
        )
      )
        throw new Error(
          "Embedding columns disagree; restore a consistent database",
        );
      const observed = {
        ...metadata,
        dimensions: columns.rows[0].dimensions,
        kind: columns.rows[0].kind as "vector" | "halfvec",
      };
      state.vector = observed;
      const seeded = await seed(trx);
      return { ...seeded, metadata: observed };
    });
  } catch (error) {
    delete state.vector;
    throw error;
  }
  // Never destroy bootDb: it shares the running application's pool.
}

async function seed(trx: Transaction<DB>) {
  const config = getConfig();
  let settings = await trx
    .selectFrom("settings")
    .select(["id", "setupCompletedAt"])
    .where("id", "=", 1)
    .executeTakeFirst();
  if (!settings) {
    const existingUser = await trx
      .selectFrom("user")
      .select("id")
      .limit(1)
      .executeTakeFirst();
    if (existingUser)
      throw new BootError(
        "settings-corrupt",
        "Settings are missing on a populated database; restore from backup",
      );
    settings = await trx
      .insertInto("settings")
      .values({ id: 1 })
      .returning(["id", "setupCompletedAt"])
      .executeTakeFirstOrThrow();
  }
  await trx
    .insertInto("instance_secret")
    .values({ id: 1 })
    .onConflict((c) => c.column("id").doNothing())
    .execute();
  await ensureAiSettingsRow(trx);
  await trx
    .insertInto("auth_runtime")
    .values({ id: 1 })
    .onConflict((c) => c.column("id").doNothing())
    .execute();
  const secret = await trx
    .selectFrom("instance_secret")
    .select(["authSecret", "setupCode", "setupCodeGenerated"])
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  const authSecret =
    config.injectedAuthSecret ??
    secret.authSecret ??
    randomBytes(32).toString("base64url");
  if (!config.injectedAuthSecret && !secret.authSecret)
    await trx
      .updateTable("instance_secret")
      .set({ authSecret })
      .where("id", "=", 1)
      .execute();
  const setupComplete = settings.setupCompletedAt !== null;
  const injected = setupComplete
    ? undefined
    : validateCode("SETUP_CODE", config.setupCode);
  const setupCode = setupComplete
    ? null
    : (injected ?? secret.setupCode ?? randomBytes(32).toString("hex"));
  const setupCodeGenerated =
    !setupComplete &&
    !injected &&
    (!secret.setupCode || secret.setupCodeGenerated);
  await trx
    .updateTable("instance_secret")
    .set({ setupCode, setupCodeGenerated })
    .where("id", "=", 1)
    .execute();
  await sql`update insight_reports set status='failed', stage='complete', error='stale-run', "finishedAt"=clock_timestamp(), "inputSnapshot"=null where status='running' and "heartbeatAt"<clock_timestamp()-interval '5 minutes'`.execute(
    trx,
  );
  return {
    authSecret,
    setupComplete,
    generatedSetupCode: setupCodeGenerated ? setupCode : null,
  };
}
export async function verifySetupCode(input: string) {
  const stored = await new Kysely<DB>({
    dialect: new PostgresDialect({ pool: getPool() }),
  })
    .selectFrom("instance_secret")
    .select("setupCode")
    .where("id", "=", 1)
    .executeTakeFirst();
  const decode = (code: string) => {
    const trimmed = code.replace(/^[\x09-\x0d\x20]+|[\x09-\x0d\x20]+$/g, "");
    if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
    const bytes = Buffer.from(trimmed, "base64");
    return bytes.length === 32 && bytes.toString("base64") === trimmed
      ? bytes
      : null;
  };
  const a = decode(input),
    b = stored?.setupCode ? decode(stored.setupCode) : null;
  return !!a && !!b && a.length === b.length && timingSafeEqual(a, b);
}
export async function clearSetupCode(trx: Transaction<DB>) {
  await trx
    .updateTable("instance_secret")
    .set({ setupCode: null, setupCodeGenerated: false })
    .where("id", "=", 1)
    .execute();
}
export function boot() {
  const state = runtimeState();
  return (state.boot ??= (async () => {
    neutraliseAuthEnv();
    getConfig().database();
    await waitForDatabase();
    const result = await migrateAndSeed();
    state.authSecret = result.authSecret;
    state.setupComplete = result.setupComplete;
    state.vector = result.metadata;
    state.booted = true;
    log("boot.ready", {
      version: identity.version,
      dimensions: result.metadata.dimensions,
    });
    const config = getConfig();
    const endpoint = new URL(config.database().connectionString!);
    log("boot.database", {
      host: endpoint.hostname,
      port: endpoint.port || "5432",
      version: result.metadata.version,
      name: result.metadata.schema,
      dimensions: result.metadata.dimensions,
    });
    if (config.appUrl) {
      const origin = new URL(config.appUrl);
      log("boot.app-url", {
        name: config.appUrlSource,
        host: origin.host,
        stage: origin.protocol.slice(0, -1),
      });
    } else log("boot.app-url-inferred-email-social-disabled");
    log("boot.client-ip", {
      name: config.clientIpHeader,
      count: config.trustedProxies.length,
    });
    log("boot.phase-1-auth-uploads-ai-disabled");
    log("boot.ai-environment-ignored", { name: "OPENROUTER_API_KEY" });
    // An internally generated code is deliberately printed only in the private
    // startup log. Injected setup/auth/recovery values are never logged.
    if (result.generatedSetupCode)
      console.info(`Setup code (keep private): ${result.generatedSetupCode}`);
    const { startHousekeeping } = await import("../housekeeping");
    startHousekeeping();
  })());
}
