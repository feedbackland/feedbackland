import assert from "node:assert/strict";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { db } from "../../db/db";
import { startInsightsRun } from "../../lib/jobs/insights";
import { mockOpenRouter, chat } from "../mock-llm";
import { insightAnswer } from "./insights-fixture";
import { admin, setup, seed, ended, report } from "./insight-test-support";

async function main() {
  const boot = await migrateAndSeed();
  runtimeState().authSecret = boot.authSecret;
  await setup();
  await seed(201);
  const mock = await mockOpenRouter();
  mock.handler = insightAnswer;
  await ended((await startInsightsRun(admin)).id);
  mock.handler = (wire) => chat(wire.response, 0.001, "stop", "{}");
  await ended((await startInsightsRun(admin)).id, "invalid-response");
  const arrived = Promise.withResolvers<void>();
  mock.handler = async () => {
    arrived.resolve();
    await new Promise(() => {});
  };
  const run = await startInsightsRun(admin);
  await arrived.promise;
  assert((await report(run.id)).requestPlan);
  assert.equal(
    (await db.selectFrom("insight_reports").select("id").execute()).length,
    3,
  );
  // Stop the owning process with admitted work still in flight, before a graceful cleanup.
  console.log("P10 rollback fixture ready");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
