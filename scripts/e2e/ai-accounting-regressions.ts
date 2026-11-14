import assert from "node:assert/strict";
import { db, getPool } from "../../db/db";
import { sql } from "kysely";
import type { Actor } from "../../lib/auth/authorization";
import { callChat, readProviderMetadata } from "../../lib/llm/client";
import {
  beginCheck,
  configuration,
  saveConfiguration,
} from "../../lib/llm/settings-store";
import { reserveInsightPlan } from "../../lib/llm/usage";
import { runtimeState } from "../../lib/runtime-state";
import { eventually } from "./run";
import { chat, json, type mockOpenRouter } from "../mock-llm";

type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
const prompt = { system: "Answer briefly", text: "fixture" };
const usage = () =>
  db
    .selectFrom("llm_usage")
    .selectAll()
    .where("feature", "=", "title")
    .executeTakeFirstOrThrow();
const limits = () =>
  db
    .selectFrom("rate_limit")
    .select(["key", "count"])
    .where("key", "like", "ai%")
    .orderBy("key")
    .execute();
const health = () =>
  db
    .selectFrom("ai_health")
    .selectAll()
    .orderBy("configToken")
    .orderBy("capability")
    .execute();

async function locked(
  query: string,
  work: () => Promise<void>,
  params: unknown[] = [],
) {
  const locker = await getPool().connect();
  try {
    await locker.query("begin");
    await locker.query(query, params);
    await work();
  } finally {
    await locker.query("rollback");
    locker.release();
  }
}
async function waiting(pattern: string) {
  await eventually(
    async () =>
      (
        await sql<{
          waiting: boolean;
        }>`select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query ilike ${pattern}) as waiting`.execute(
          db,
        )
      ).rows[0].waiting,
    (result) => result,
  );
}
export async function accountingRegressions(mock: Mock, actor: Actor) {
  await saveConfiguration(actor, await configuration(), {
    options: { timeoutMs: 1000, dailyCallLimit: 5000 },
  });
  const config = await configuration();
  const check = await beginCheck(config, { actor, intent: "test-again" });
  for (const kind of ["deadline", "cancel", "metadata", "diagnostic-quota"]) {
    const diagnosticKey =
      "ai:instance:day:diagnostic:" + new Date().toISOString().slice(0, 10);
    if (kind === "diagnostic-quota") {
      await db
        .insertInto("rate_limit")
        .values({ key: diagnosticKey, count: 0 })
        .execute();
      await db
        .updateTable("rate_limit")
        .where("key", "=", diagnosticKey.replace("diagnostic:", ""))
        .set({ count: 4000 })
        .execute();
    }
    const beforeUsage = await usage(),
      beforeLimits = await limits(),
      beforeHealth = await health(),
      sent = mock.requests;
    const external = new AbortController();
    await locked(
      kind === "diagnostic-quota"
        ? "select count from rate_limit where key=$1 for update"
        : "select id from ai_settings where id=1 for update",
      async () => {
        const request =
          kind === "metadata"
            ? readProviderMetadata("key", undefined, external.signal, check)
            : kind === "diagnostic-quota"
              ? callChat("check", prompt, { check, signal: external.signal })
              : callChat("title", prompt, { signal: external.signal });
        const outcome = assert.rejects(request, {
          reason: kind === "deadline" ? "timeout" : "aborted",
        });
        await waiting(
          kind === "diagnostic-quota"
            ? "%insert into rate_limit%"
            : "%ai_settings%for share%",
        );
        if (kind !== "deadline") external.abort();
        await outcome;
        assert.deepEqual(runtimeState().aiWork, {
          model: 0,
          vision: 0,
          metadata: 0,
        });
      },
      kind === "diagnostic-quota" ? [diagnosticKey] : [],
    );
    assert.deepEqual(await limits(), beforeLimits);
    assert.deepEqual(await usage(), beforeUsage);
    assert.deepEqual(await health(), beforeHealth);
    assert.equal(mock.requests, sent);
    if (kind === "diagnostic-quota")
      await db
        .deleteFrom("rate_limit")
        .where("key", "like", "ai:instance:day:%")
        .execute();
  }

  // Hold COMMIT after all admission writes. Cancellation releases the caller's
  // slot while the transaction is still waiting, then refunds its own window.
  await saveConfiguration(actor, await configuration(), {
    options: { timeoutMs: 10000 },
  });
  await callChat("title", prompt);
  await db
    .updateTable("rate_limit")
    .set({ windowStart: sql`clock_timestamp()` })
    .where("key", "in", ["ai:metadata:minute", "ai-check:user:" + actor.userId])
    .execute();
  for (const table of ["llm_usage", "rate_limit"] as const) {
    const predicate =
      table === "llm_usage" ? "new.calls > old.calls" : "new.count > old.count";
    await sql`create function fixture_hold_commit() returns trigger language plpgsql as $$
      begin perform pg_advisory_xact_lock(70182); return new; end $$`.execute(
      db,
    );
    try {
      await sql
        .raw(
          `create constraint trigger fixture_hold_commit after update on ${table}
        deferrable initially deferred for each row when (${predicate})
        execute function fixture_hold_commit()`,
        )
        .execute(db);
      const before = await usage(),
        budget = await limits(),
        sent = mock.requests;
      const external = new AbortController();
      await locked("select pg_advisory_xact_lock(70182)", async () => {
        const request =
          table === "llm_usage"
            ? callChat("title", prompt, { signal: external.signal })
            : readProviderMetadata("key", actor, external.signal);
        const result = assert.rejects(request, { reason: "aborted" });
        await waiting("commit%");
        const start = performance.now();
        external.abort();
        await result;
        assert(performance.now() - start < 1000);
        assert.deepEqual(runtimeState().aiWork, {
          model: 0,
          vision: 0,
          metadata: 0,
        });
      });
      // Queue behind the waiting COMMIT before checking its visible outcome.
      await sql`select pg_advisory_xact_lock(70182)`.execute(db);
      await eventually(
        async () => {
          assert.deepEqual(await usage(), before);
          assert.deepEqual(await limits(), budget);
          return true;
        },
        Boolean,
        5000,
      );
      assert.equal(mock.requests, sent);
    } finally {
      await sql
        .raw(`drop trigger if exists fixture_hold_commit on ${table}`)
        .execute(db);
      await sql`drop function fixture_hold_commit()`.execute(db);
    }
  }

  // Admission succeeds. Failure occurs only while settling the returned result.
  for (const table of ["llm_usage", "ai_health"] as const) {
    const predicate =
      table === "llm_usage"
        ? "new.calls=old.calls"
        : 'new."lastAppliedSequence"<>old."lastAppliedSequence"';
    await sql
      .raw(
        `create function fixture_settlement_failure() returns trigger language plpgsql as $$ begin if ${predicate} then raise exception 'fixture unavailable'; end if; return new; end $$`,
      )
      .execute(db);
    try {
      await sql
        .raw(
          `create trigger fixture_settlement before update on ${table} for each row execute function fixture_settlement_failure()`,
        )
        .execute(db);
      const before = await usage();
      mock.handler = ({ response }) => chat(response);
      assert.equal((await callChat("title", prompt)).text, "fixture answer");
      mock.handler = ({ response }) =>
        json(response, { error: { code: 429 } }, 429);
      await assert.rejects(callChat("title", prompt), {
        reason: "provider-rate",
        status: 429,
      });
      const unsettled = await usage();
      assert.equal(unsettled.calls, before.calls + 2);
      assert.equal(unsettled.uncostedCalls, before.uncostedCalls + 2);
      assert.equal(unsettled.costUsd, before.costUsd);
    } finally {
      await sql
        .raw(`drop trigger if exists fixture_settlement on ${table}`)
        .execute(db);
      await sql`drop function fixture_settlement_failure()`.execute(db);
      mock.reset();
    }
    const before = await usage();
    await callChat("title", prompt);
    const after = await usage();
    assert.equal(after.calls, before.calls + 1);
    assert.equal(after.uncostedCalls, before.uncostedCalls);
  }

  await saveConfiguration(actor, await configuration(), {
    options: { timeoutMs: 10000 },
  });
  const active = await configuration(),
    plan = { snapshot: "fixture-snapshot", groups: [["a", "b"], ["c"]] };
  await db.deleteFrom("insight_reports").execute();
  const report = await db
    .insertInto("insight_reports")
    .values({
      status: "running",
      stage: "admitting",
      owner: "owner-a",
      fence: "1",
      configToken: active.token,
      inputHash: plan.snapshot,
      requestPlan: plan,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const owner = { runId: report.id, owner: "owner-a", fence: "1" },
    name = "insight:" + report.id;
  await db
    .insertInto("job_lease")
    .values({
      name,
      holder: owner.owner,
      fence: owner.fence,
      until: sql`clock_timestamp()+interval '30 seconds'`,
    })
    .execute();
  const reserve = (groups: string[][]) =>
    db
      .transaction()
      .execute((t) =>
        reserveInsightPlan(t, active, owner, { ...plan, groups }),
      );
  const ticket = await reserve(plan.groups);
  const record = () =>
    db
      .selectFrom("insight_reports")
      .select(["requestPlan", "reservationCount"])
      .where("id", "=", report.id)
      .executeTakeFirstOrThrow();
  assert.deepEqual((await record()).requestPlan, {
    ...plan,
    chunks: 2,
    merge: true,
  });
  const budget = await limits();
  assert.deepEqual(await reserve(plan.groups), ticket);
  await assert.rejects(reserve([["a"], ["b", "c"]]), {
    reason: "RESERVATION_EXPIRED",
  });
  assert.deepEqual(await limits(), budget);
  await callChat("insights", prompt, { reservation: ticket });
  assert.deepEqual(mock.last.body.reasoning, {
    effort: "medium",
    exclude: true,
  });
  const remaining = (await record()).reservationCount,
    sent = mock.requests;
  await db
    .updateTable("job_lease")
    .where("name", "=", name)
    .set({ until: sql`clock_timestamp()+interval '1 second'` })
    .execute();
  let outcome: Promise<void> | undefined;
  let reservationRetry: Promise<void> | undefined;
  await locked(
    "select id from insight_reports where id=$1 for update",
    async () => {
      outcome = assert.rejects(
        callChat("insights", prompt, { reservation: ticket }),
        { reason: "RESERVATION_EXPIRED" },
      );
      reservationRetry = assert.rejects(reserve(plan.groups), {
        reason: "RESERVATION_EXPIRED",
      });
      await waiting("update %insight_reports%");
      await waiting("%insight_reports%for update%");
      await eventually(
        async () =>
          (await db
            .selectFrom("job_lease")
            .select("name")
            .where("name", "=", name)
            .where("until", "<=", sql<Date>`clock_timestamp()`)
            .executeTakeFirst()) !== undefined,
        Boolean,
      );
    },
    [report.id],
  );
  await outcome;
  await reservationRetry;
  assert.equal((await record()).reservationCount, remaining);
  assert.equal(mock.requests, sent);
  await db
    .updateTable("job_lease")
    .where("name", "=", name)
    .set({
      until: sql`clock_timestamp()+interval '30 seconds'`,
      holder: "owner-b",
      fence: "2",
    })
    .execute();
  await assert.rejects(callChat("insights", prompt, { reservation: ticket }), {
    reason: "RESERVATION_EXPIRED",
  });
  assert.equal((await record()).reservationCount, remaining);
  assert.equal(mock.requests, sent);
}
