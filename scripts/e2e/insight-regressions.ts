import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { Client } from "pg";
import { sql } from "kysely";
import { db } from "../../db/db";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { DomainError } from "../../lib/domain-error";
import {
  getInsightsRun,
  startInsightJob,
  startInsightsRun,
} from "../../lib/jobs/insights";
import { callChat } from "../../lib/llm/client";
import {
  beginCheck,
  configuration,
  invalidateConfiguration,
  replicaId,
  saveCheck,
  saveConfiguration,
} from "../../lib/llm/settings-store";
import { getInsightsQuery } from "../../queries/get-insights";
import { chat, json, mockOpenRouter } from "../mock-llm";
import {
  answerInsight,
  insightAnswer,
  insightRequest,
} from "./insights-fixture";
import {
  admin,
  setup,
  seed,
  ended,
  budget,
  setBudget,
  calls,
} from "./insight-test-support";
import {
  membershipAndHistory,
  pagingAndAnonymous,
  mergeAndEmpty,
  popularBoardAndArchive,
} from "./insight-report-regressions";
import { eventually } from "./run";
type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
const currentModel = "fixture/peer-model";
const phase = async (n: number) => {
  await db.deleteFrom("feedback").execute();
  await seed(n);
  await setBudget(0);
};
const stats = async () =>
  (
    await sql<{
      errors: number;
      tokens: number;
    }>`select coalesce(sum(errors),0)::int as errors,coalesce(sum("outputTokens"),0)::int as tokens from llm_usage where feature='insights'`.execute(
      db,
    )
  ).rows[0];
async function peer() {
  const child = fork(process.argv[1], ["--peer"], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const exited = once(child, "exit");
  const message = () =>
    once(child, "message", { signal: AbortSignal.timeout(15000) }).then(([v]) =>
      String(v),
    );
  try {
    const id = await message();
    return {
      id,
      fire: (op: string) => child.send(op),
      async run(op: string) {
        const ack = message();
        child.send(op);
        assert.equal(await ack, "ok");
      },
      async stop() {
        child.kill("SIGKILL");
        await exited;
      },
    };
  } catch (e) {
    child.kill("SIGKILL");
    throw e;
  }
}
async function admission(mock: Mock) {
  await phase(201);
  const other = await peer();
  try {
    invalidateConfiguration();
    assert.notEqual((await configuration()).options.model, currentModel);
    await other.run("configure");
    const models: string[] = [];
    mock.handler = (wire) => {
      models.push(String(wire.body.model));
      return insightAnswer(wire);
    };
    const run = await startInsightsRun(admin);
    await ended(run.id);
    assert.deepEqual(models, [currentModel, currentModel, currentModel]);
    assert.equal(await budget(run.id), 3);
  } finally {
    await other.stop();
  }
  const gate = Promise.withResolvers<void>();
  let arrived = 0;
  mock.handler = async (wire) => {
    arrived++;
    await gate.promise;
    chat(wire.response);
  };
  const requests = Array.from({ length: 8 }, () =>
    callChat("rewrite", { system: "Rewrite", text: "Fixture" }),
  );
  try {
    await eventually(
      async () => arrived,
      (n) => n === 8,
      10000,
    );
    const before = await budget(),
      wires = mock.requests;
    await assert.rejects(startInsightsRun(admin), { message: "AI_BUSY" });
    assert.equal(await budget(), before);
    assert.equal(mock.requests, wires);
  } finally {
    gate.resolve();
    await Promise.all(requests);
  }
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  mock.handler = async (wire) => {
    entered.resolve();
    await release.promise;
    await insightAnswer(wire);
  };
  const active = await startInsightsRun(admin);
  await entered.promise;
  try {
    const ticket = await beginCheck(await configuration(), {
      actor: admin,
      intent: "test-again",
    });
    await saveCheck(ticket, {
      key: "invalid",
      chat: "untested",
      search: "untested",
    });
    release.resolve();
    await ended(active.id, "provider-auth");
    assert.equal((await getInsightsRun(admin))?.error, "provider-auth");
    await assert.rejects(
      startInsightsRun(admin),
      (e) => e instanceof DomainError && e.reason === "provider-auth",
    );
    const fresh = await beginCheck(await configuration(), {
      actor: admin,
      intent: "test-again",
    });
    await saveCheck(fresh, { key: "valid", chat: "passed", search: "passed" });
  } finally {
    release.resolve();
  }
}
async function outputFailures(mock: Mock) {
  for (const mode of [
    "member",
    "overlap",
    "chunk-cutoff",
    "merge-cutoff",
    "parseable-cutoff",
  ]) {
    await phase(mode === "member" ? 3 : 201);
    mock.handler = insightAnswer;
    await ended((await startInsightsRun(admin)).id);
    const prior = await getInsightsQuery();
    const before = await stats(),
      wires = mock.requests,
      usage = await calls();
    let batch = 0;
    mock.handler = (wire) => {
      const { merge } = insightRequest(wire.body);
      if (mode === "member")
        return chat(
          wire.response,
          0.001,
          "stop",
          JSON.stringify({
            insights: [
              {
                title: "Invalid",
                description: "Missing member",
                severity: 1,
                ids: [4],
              },
            ],
          }),
        );
      if (mode === "overlap" && merge)
        return chat(wire.response, 0.001, "stop", '{"groups":[[0,1],[0,1]]}');
      if (mode.includes("cutoff") && (merge || mode === "chunk-cutoff")) {
        const content =
          mode === "parseable-cutoff"
            ? '{"groups":[]}'
            : merge
              ? '{"groups":[[0,1'
              : '{"insights":[';
        return json(wire.response, {
          object: "chat.completion",
          id: "fixture",
          model: "fixture",
          created: 1,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content },
              finish_reason: "length",
            },
          ],
          usage: {
            prompt_tokens: 82,
            completion_tokens: 4096,
            total_tokens: 4178,
            cost: 0.01,
          },
        });
      }
      return answerInsight(wire, "Group " + ++batch);
    };
    const run = await startInsightsRun(admin);
    await ended(run.id, "invalid-response");
    const expected = mode === "member" || mode === "chunk-cutoff" ? 1 : 3;
    assert.equal(mock.requests - wires, expected);
    assert.equal((await calls()) - usage, expected);
    assert.equal((await stats()).errors - before.errors, 1);
    if (mode.includes("cutoff"))
      assert((await stats()).tokens - before.tokens >= 4096);
    const health = await db
      .selectFrom("ai_health")
      .select(["lastFailureAt", "lastReason"])
      .where("capability", "=", "chat")
      .where("configToken", "=", (await configuration()).token)
      .executeTakeFirstOrThrow();
    assert(health.lastFailureAt);
    assert.equal(health.lastReason, "provider-error");
    assert.deepEqual(await getInsightsQuery(), prior);
  }
}
async function recovery(mock: Mock) {
  await phase(201);
  mock.handler = insightAnswer;
  await ended((await startInsightsRun(admin)).id);
  const gate = new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "insight-test-gate",
  });
  const reader = new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "insight-test-observer",
  });
  await gate.connect();
  await reader.connect();
  const waiting = (pattern: string) =>
    eventually(
      async () =>
        Number(
          (
            await reader.query(
              "select count(*) as n from pg_stat_activity where datname=current_database() and application_name='feedbackland-app' and wait_event_type='Lock' and query ilike $1",
              [pattern],
            )
          ).rows[0].n,
        ),
      (n) => n > 0,
      4500,
    );
  try {
    for (const stage of ["admitting", "admitted"]) {
      const actor = await peer();
      const previous = await budget(),
        wire = mock.requests;
      try {
        await gate.query("begin");
        if (stage === "admitting")
          await gate.query(
            "select key from rate_limit where key='ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD') for update",
          );
        else
          await gate.query(
            "select day from llm_usage where feature='insights' for update",
          );
        actor.fire("start");
        await waiting(
          stage === "admitting"
            ? "%insert into rate_limit%"
            : "%insert into%llm_usage%",
        );
        const state = (
          await reader.query(
            "select id,stage from insight_reports where status='running'",
          )
        ).rows[0];
        assert.equal(state.stage, stage);
        await actor.stop();
        await gate.query("rollback");
        await db
          .updateTable("insight_reports")
          .where("id", "=", state.id)
          .set({ heartbeatAt: new Date(Date.now() - 360000) })
          .execute();
        await getInsightsRun(admin);
        await ended(state.id, "stale-run");
        assert.equal(mock.requests, wire);
        assert.equal(
          (await budget()) - previous,
          stage === "admitting" ? 0 : 3,
        );
      } finally {
        await actor.stop();
        await gate.query("rollback");
      }
    }
    const boot = await peer();
    try {
      await db
        .insertInto("insight_reports")
        .values({
          stage: "admitting",
          status: "running",
          configToken: "previous",
          owner: "stopped",
          fence: "1",
          heartbeatAt: new Date(Date.now() - 360000),
        })
        .execute();
      await gate.query("begin");
      await gate.query("select name from job_lease where name=$1 for update", [
        "ai-config:" + boot.id,
      ]);
      const booted = boot.run("boot");
      await waiting("%insert into%job_lease%");
      const starting = startInsightJob(admin);
      void starting.catch(() => {});
      await waiting("%ai_settings%for share%");
      await gate.query("commit");
      await booted;
      const job = await starting;
      await job.finished;
      await ended(job.run.id);
    } finally {
      await gate.query("rollback");
      await boot.stop();
    }
  } finally {
    await gate.end();
    await reader.end();
  }
}
async function minimum(mock: Mock) {
  await seed(2000);
  await assert.rejects(
    startInsightsRun(admin),
    (e) =>
      e instanceof DomainError &&
      e.message === "INSIGHT_PLAN_TOO_LARGE" &&
      e.resetsAt === undefined,
  );
  assert.equal((await getInsightsRun(admin))?.error, "INSIGHT_PLAN_TOO_LARGE");
  assert.equal(await budget(), 0);
  await phase(201);
  await setBudget(7);
  await assert.rejects(
    startInsightsRun(admin),
    (e) =>
      e instanceof DomainError && e.message === "AI_PAUSED" && !!e.resetsAt,
  );
  assert.equal(mock.requests, 0);
  assert.equal(await budget(), 7);
}
async function main() {
  const initial = await migrateAndSeed();
  runtimeState().authSecret = initial.authSecret;
  if (process.argv.includes("--peer")) {
    process.on("message", (op) => {
      void (async () => {
        if (op === "configure")
          await saveConfiguration(admin, await configuration(), {
            options: { model: currentModel },
          });
        if (op === "boot") await migrateAndSeed();
        if (op === "start") await startInsightsRun(admin);
        process.send!("ok");
      })().catch(() => process.send!("failed"));
    });
    process.send!(replicaId());
    return;
  }
  const mock = await mockOpenRouter();
  try {
    await setup();
    if ((await configuration()).options.dailyCallLimit === 10)
      await minimum(mock);
    else {
      await admission(mock);
      await outputFailures(mock);
      await recovery(mock);
      await membershipAndHistory(mock);
      await pagingAndAnonymous(mock);
      await mergeAndEmpty(mock);
      await popularBoardAndArchive(mock);
    }
    console.log("Insight regressions passed");
  } finally {
    await mock.close();
    await db.destroy();
    await runtimeState().maintenancePool?.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
