import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { db } from "../../db/db";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { getInsightsQuery } from "../../queries/get-insights";

// The harness mounts the exact P09 source for all three application imports.
async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    const rollback = await readFile(
      "scripts/ops/prepare-p09-insights-rollback.sql",
      "utf8",
    );
    const ledger = async () =>
      (
        await pg.query(
          "select key,count from rate_limit where key like 'ai:instance:day:%' order by key",
        )
      ).rows;
    const before = await ledger();
    assert.equal(
      before.reduce((s, r) => s + r.count, 0),
      9,
    );
    const {
      rows: [success],
    } = await pg.query(
      `select id,"createdAt" from insight_reports where status='succeeded'`,
    );
    await pg.query(rollback);
    await pg.query(rollback);
    const boot = await migrateAndSeed();
    runtimeState().authSecret = boot.authSecret;
    const view = await getInsightsQuery();
    assert.equal(view.insights.length, 1);
    assert.equal(view.run?.insightCount, 1);
    assert.equal(view.run?.createdAt.getTime(), success.createdAt.getTime());
    const { rows } = await pg.query(
      "select report from insight_rollback_history order by id",
    );
    assert.deepEqual(
      rows.map((r) => r.report.error),
      ["invalid-response", "stale-run"],
    );
    assert(
      rows.every(
        (r) =>
          r.report.status === "failed" &&
          !("inputSnapshot" in r.report) &&
          !("requestPlan" in r.report),
      ),
    );
    assert.deepEqual((await pg.query("select id from insight_reports")).rows, [
      { id: success.id },
    ]);
    assert.deepEqual(await ledger(), before);
    // Repeat the supported operation on a board whose first attempt never produced any themes.
    await pg.query("delete from insight_reports");
    await pg.query("delete from insights");
    await pg.query(
      `insert into insight_reports(status,stage,owner,fence,"configToken") values('running','admitting','stopped',1,'fixture')`,
    );
    await pg.query(rollback);
    assert.equal((await getInsightsQuery()).run, null);
    assert.deepEqual(await ledger(), before);
    console.log("P09 rollback passed");
  } finally {
    await pg.end();
    await db.destroy();
    await runtimeState().maintenancePool?.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
