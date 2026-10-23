import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sql } from "kysely";
import { db, getPool } from "../../db/db";
import { migrateAndSeed, verifySetupCode } from "../../lib/boot";
import { migrations } from "../../db/migrations";
import * as failure from "./fixtures/9998_fail";
import { runtimeState } from "../../lib/runtime-state";
import { getConfig, neutraliseAuthEnv } from "../../lib/config";
import { locks } from "../../db/locks";
import { membershipAndReplies } from "./v19-auth-invariants";
import { revisions } from "./v21-state-transitions";
import { vectorDistance, vectorMetadata } from "../../db/vector";
import { sweep } from "../../lib/housekeeping";
import { checkRateLimit } from "../../queries/check-rate-limit";
import { readSurfaces } from "./v8-search";
import { rpcContracts } from "./rpc-contracts";
let outboundHttp = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  outboundHttp++;
  throw new Error("Outbound HTTP is forbidden in phase 1 database operations");
};

async function schemaAssertions() {
  const config = getConfig();
  const tables = await sql<{
    table_name: string;
  }>`select table_name from information_schema.tables where table_schema=current_schema() and table_type='BASE TABLE' order by table_name`.execute(
    db,
  );
  assert.deepEqual(
    tables.rows.map((row) => row.table_name),
    JSON.parse(await readFile("ci/fixtures/schema-tables.json", "utf8")).sort(),
  );
  const type = await sql<{
    type: string;
  }>`select format_type(atttypid,atttypmod) as type from pg_attribute where attrelid='feedback'::regclass and attname='embedding'`.execute(
    db,
  );
  assert(
    type.rows[0].type.endsWith(
      `${config.dimensions > 2000 ? "halfvec" : "vector"}(${config.dimensions})`,
    ),
  );
  const indexes = await sql<{
    name: string;
    definition: string;
  }>`select indexname as name,indexdef as definition from pg_indexes where schemaname=current_schema()`.execute(
    db,
  );
  assert.equal(
    indexes.rows.filter((row) => row.definition.includes("USING hnsw")).length,
    2,
  );
  for (const name of [
    "image_ref_post_idx",
    "image_ref_comment_idx",
    "moderation_post_revision_idx",
    "moderation_comment_revision_idx",
    "insight_reports_running_idx",
    "insights_archived_idx",
    "insight_reports_created_idx",
    "feedback_author_idx",
    "feedback_backfill_idx",
    "comment_backfill_idx",
  ])
    assert(
      indexes.rows.some((row) => row.name === name),
      name,
    );
  for (const table of [
    "settings",
    "instance_secret",
    "ai_settings",
    "auth_runtime",
  ] as const)
    await assert.rejects(
      sql`insert into ${sql.table(table)}(id) values(2)`.execute(db),
      (error: unknown) => (error as { code: string }).code === "23514",
    );
  await assert.rejects(
    db
      .insertInto("job_lease")
      .values({
        name: "invalid",
        holder: "fixture",
        until: new Date(),
        fence: "0",
      })
      .execute(),
    (error: unknown) => (error as { code: string }).code === "23514",
  );
  const report = {
    status: "running",
    stage: "admitting",
    configToken: "fixture",
    owner: "fixture",
    fence: "1",
  };
  const running = await db
    .insertInto("insight_reports")
    .values(report)
    .returning("id")
    .executeTakeFirstOrThrow();
  await assert.rejects(
    db.insertInto("insight_reports").values(report).execute(),
    (error: unknown) => (error as { code: string }).code === "23505",
  );
  await db.deleteFrom("insight_reports").where("id", "=", running.id).execute();
  const vector = Array.from({ length: config.dimensions }, (_, i) =>
    i === 0 ? 1 : 0,
  );
  const row = await db
    .insertInto("feedback")
    .values({
      title: "Vector",
      description: "Vector",
      plainText: "Vector",
      moderationState: "disabled",
      embedding: JSON.stringify(vector),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const distance = await db
    .selectFrom("feedback")
    .select(vectorDistance(sql.ref("embedding"), vector).as("distance"))
    .where("id", "=", row.id)
    .executeTakeFirstOrThrow();
  assert.equal(distance.distance, 0);
  if (vectorMetadata().schema !== "public")
    await assert.rejects(
      sql`select embedding <=> ${JSON.stringify(vector)} from feedback`.execute(
        db,
      ),
      (error: unknown) => (error as { code: string }).code === "42883",
    );
}
async function main() {
  neutraliseAuthEnv();
  const mode = process.argv[2] ?? "all";
  if (mode === "existing-schema") {
    await sql`create table unrelated_fixture (id integer primary key)`.execute(
      db,
    );
    await sql`insert into unrelated_fixture values (1)`.execute(db);
    await assert.rejects(migrateAndSeed(), /fresh disposable database/);
    assert.equal(
      (
        await sql<{
          count: number;
        }>`select count(*)::int as count from unrelated_fixture`.execute(db)
      ).rows[0].count,
      1,
    );
    assert.equal(
      (
        await sql<{
          count: number;
        }>`select count(*)::int as count from information_schema.tables where table_schema=current_schema()`.execute(
          db,
        )
      ).rows[0].count,
      1,
    );
    console.log("Existing schema refused and preserved");
    return;
  }
  if (mode === "failure") {
    await assert.rejects(
      migrateAndSeed({ ...migrations, "9998_fail": failure }),
      (error: unknown) => (error as { code: string }).code === "42P01",
    );
    const tables = await sql<{
      count: number;
    }>`select count(*)::int as count from information_schema.tables where table_schema=current_schema()`.execute(
      db,
    );
    assert.equal(
      tables.rows[0].count,
      0,
      "Failed migration left schema/tracking/seed behind",
    );
    const acquired = await sql<{
      acquired: boolean;
    }>`select pg_try_advisory_xact_lock(${locks.boot.toString()}::bigint) as acquired`.execute(
      db,
    );
    assert.equal(acquired.rows[0].acquired, true);
  }
  const first = await migrateAndSeed();
  assert.equal(
    first.authSecret,
    getConfig().injectedAuthSecret ?? first.authSecret,
  );
  if (mode === "boot-only" || mode === "failure") {
    console.log(
      JSON.stringify({ mode, retried: mode === "failure", migrated: true }),
    );
    return;
  }
  await schemaAssertions();
  console.error("database worker: schema assertions passed");
  const actor = await membershipAndReplies();
  console.error("database worker: membership/replies passed");
  await revisions(actor);
  console.error("database worker: revisions passed");
  await readSurfaces(actor);
  console.error("database worker: read surfaces passed");
  await rpcContracts(actor);
  console.error("database worker: RPC contracts passed");
  await sql`alter table rate_limit rename to rate_limit_fixture`.execute(db);
  try {
    assert.equal(
      (
        await checkRateLimit({
          key: "fixture",
          limit: 1,
          windowSeconds: 60,
          failClosed: true,
        })
      ).allowed,
      false,
    );
    assert.equal(
      (await checkRateLimit({ key: "fixture", limit: 1, windowSeconds: 60 }))
        .allowed,
      true,
    );
  } finally {
    await sql`alter table rate_limit_fixture rename to rate_limit`.execute(db);
  }
  const before = await db
    .selectFrom("instance_secret")
    .select(["authSecret", "setupCode"])
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  if (getConfig().injectedAuthSecret)
    assert.notEqual(
      before.authSecret,
      getConfig().injectedAuthSecret,
      "Injected auth secret was persisted",
    );
  const next = await migrateAndSeed();
  assert.equal(first.authSecret, next.authSecret);
  const after = await db
    .selectFrom("instance_secret")
    .select(["authSecret", "setupCode"])
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  assert.deepEqual(after, before);
  assert(before.setupCode);
  assert.equal(await verifySetupCode(`\v\f ${before.setupCode}\t\r\n`), true);
  assert.equal(await verifySetupCode(`\u00a0${before.setupCode}`), false);
  if (/^[0-9a-f]{64}$/i.test(before.setupCode))
    assert.equal(await verifySetupCode(before.setupCode.toUpperCase()), true);
  else
    assert.equal(
      await verifySetupCode(
        before.setupCode.replace(/[A-Za-z]/, (letter) =>
          letter === letter.toUpperCase()
            ? letter.toLowerCase()
            : letter.toUpperCase(),
        ),
      ),
      false,
    );
  const originalSetup = process.env.SETUP_CODE;
  try {
    if (originalSetup) {
      delete process.env.SETUP_CODE;
      assert.equal(
        (await migrateAndSeed()).generatedSetupCode,
        null,
        "Formerly injected setup code would be printed after removal",
      );
      assert.equal(await verifySetupCode(originalSetup), true);
    }
    await db
      .updateTable("settings")
      .set({ setupCompletedAt: new Date() })
      .where("id", "=", 1)
      .execute();
    process.env.SETUP_CODE = "invalid-but-ignored-after-claim";
    assert.equal((await migrateAndSeed()).generatedSetupCode, null);
    assert.equal(await verifySetupCode(before.setupCode), false);
  } finally {
    if (originalSetup === undefined) delete process.env.SETUP_CODE;
    else process.env.SETUP_CODE = originalSetup;
  }
  await db
    .insertInto("rate_limit")
    .values({ key: "expired", count: 1, windowStart: new Date(0) })
    .execute();
  await sweep();
  assert.equal(
    await db
      .selectFrom("rate_limit")
      .select("key")
      .where("key", "=", "expired")
      .executeTakeFirst(),
    undefined,
  );
  // Unknown newer migrations are skipped without running the old registry.
  await sql`insert into kysely_migration(name,timestamp) values('9999_future','2026-10-18T00:00:00.000Z')`.execute(
    db,
  );
  await migrateAndSeed();
  await sql`delete from kysely_migration where name='9999_future'`.execute(db);
  // Missing public settings must not turn a populated board back into setup.
  await db.deleteFrom("settings").where("id", "=", 1).execute();
  await assert.rejects(migrateAndSeed(), /restore from backup/);
  await db.insertInto("settings").values({ id: 1 }).execute();
  await migrateAndSeed();
  const invalid = randomBytes(32).toString("hex");
  assert.notEqual(invalid, first.authSecret);
  console.log(
    JSON.stringify({
      schema: vectorMetadata().schema,
      vectorVersion: vectorMetadata().version,
      width: getConfig().dimensions,
      schemaConstraints: "passed",
      replies: "passed",
      membership: "passed",
      revisions: "passed",
      rpcContracts: "passed",
      secretPersistence: "passed",
      corruption: "refused",
      sweeps: "passed",
    }),
  );
}
main()
  .then(() => assert.equal(outboundHttp, 0))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    globalThis.fetch = originalFetch;
    const state = runtimeState();
    if (state.pool) await getPool().end();
    if (state.maintenancePool) await getPool(true).end();
  });
