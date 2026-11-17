import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { sql } from "kysely";
import { db } from "../../db/db";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { beginAttempt, cancelUndispatched } from "../../lib/llm/usage";
import { DomainError } from "../../lib/domain-error";
import {
  getInsightsRun,
  startInsightJob,
  startInsightsRun,
} from "../../lib/jobs/insights";
import { insightChunks } from "../../lib/jobs/insight-analysis";
import { getInsightsInputs } from "../../queries/get-insights-inputs";
import { getInsightsQuery } from "../../queries/get-insights";
import { sweep } from "../../lib/housekeeping";
import {
  beginCheck,
  configuration,
  saveCheck,
  saveConfiguration,
} from "../../lib/llm/settings-store";
import { chat, json, mockOpenRouter, privateMarker } from "../mock-llm";
import {
  answerInsight,
  insightAnswer,
  insightRequest,
} from "./insights-fixture";
import { eventually } from "./run";

import {
  admin,
  report,
  calls,
  budget,
  setBudget,
  ended,
  setup,
  seed,
} from "./insight-test-support";
type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
async function sizeLimits(mock: Mock) {
  await seed(2005);
  await sql`insert into feedback(title,description,"plainText",status,"moderationState") values ('Closed fixture','Body','Body','done','screened'),('Declined fixture','Body','Body','declined','screened')`.execute(
    db,
  );
  const read = () => db.transaction().execute(getInsightsInputs);
  const small = await read();
  assert.equal(small.total, 2007);
  assert.equal(small.snapshot.posts.length, 2000);
  assert.equal(small.snapshot.posts[0].title, "Fixture 1");
  assert.equal(small.snapshot.posts.at(-1)?.title, "Fixture 2000");
  assert.deepEqual(
    insightChunks(small.snapshot.posts).map((g) => g.length),
    Array(10).fill(200),
  );
  mock.handler = insightAnswer;
  const before = mock.requests;
  const first = await startInsightsRun(admin);
  const done = await ended(first.id);
  assert.equal(done.postsClustered, "2000");
  assert.equal(mock.requests - before, 11);
  await sql`update feedback set "plainText"=repeat('💡',695)||repeat(chr(34)||chr(10),8)`.execute(
    db,
  );
  const wide = await read();
  assert(wide.snapshot.posts.length > 0 && wide.snapshot.posts.length < 2000);
  assert.deepEqual(
    wide.snapshot.posts.map((p) => p.id),
    small.snapshot.posts.slice(0, wide.snapshot.posts.length).map((p) => p.id),
  );
  const {
    rows: [size],
  } = await sql<{
    size: number;
  }>`select octet_length((${JSON.stringify(wide.snapshot)}::jsonb)::text) as size`.execute(
    db,
  );
  assert(size.size <= 2 * 1024 * 1024);
  const chunks = insightChunks(wide.snapshot.posts);
  assert(chunks.length > 10);
  const wideStart = await startInsightsRun(admin);
  const wideDone = await ended(wideStart.id);
  assert.equal(Number(wideDone.postsAnalyzed), wide.snapshot.posts.length);
  assert.equal(Number(wideDone.postsClustered), wide.snapshot.posts.length);
  assert.equal(mock.requests - before, 11 + chunks.length + 1);
  // Long quoted summaries exercise the UTF-8 merge cap and the 60-row output cap.
  let summaries = 0,
    batch = 0;
  await setBudget(0);
  mock.handler = (wire) => {
    const { items, merge } = insightRequest(wire.body);
    if (merge) {
      summaries = items.length;
      chat(wire.response, 0.001, "stop", '{"groups":[]}');
      return;
    }
    batch++;
    const insights = items.map((item) => ({
      ids: [item.id],
      title: '\"'.repeat(150) + batch + "-" + item.id,
      description: '"'.repeat(800),
      evidence: "界".repeat(190),
      severity: 45,
    }));
    chat(wire.response, 0.001, "stop", JSON.stringify({ insights }));
  };
  const maximum = await startInsightsRun(admin),
    row = await ended(maximum.id);
  assert.equal(summaries, 200);
  assert.equal(row.insightCount, "60");
  const {
    rows: [output],
  } = await sql<{
    bytes: number;
  }>`select octet_length(jsonb_agg(to_jsonb(i))::text) as bytes from insights i where not "isArchived"`.execute(
    db,
  );
  assert(output.bytes < 1024 * 1024);
  await db.deleteFrom("feedback").execute();
  return {
    maxPosts: 2000,
    shortRequests: 11,
    snapshotBytes: size.size,
    widePosts: wide.snapshot.posts.length,
    wideRequests: chunks.length + 1,
    mergeSummaries: summaries,
    outputBytes: output.bytes,
  };
}

function held(mock: Mock, holdMerge = false) {
  const mergeEntered = Promise.withResolvers<void>(),
    mergeRelease = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  const seen: string[][] = [];
  mock.handler = async (wire) => {
    const { items, merge } = insightRequest(wire.body);
    seen.push(merge ? ["merge"] : items.map((p) => p.title));
    if (seen.length === 1) {
      entered.resolve();
      await release.promise;
    }
    if (holdMerge && merge) {
      mergeEntered.resolve();
      await mergeRelease.promise;
    }
    if (!wire.response.destroyed) await insightAnswer(wire);
  };
  return {
    entered: () =>
      Promise.race([
        entered.promise,
        delay(12000, undefined, { ref: false }).then(() => {
          throw Error("Insight fixture never received its first chunk");
        }),
      ]),
    release: release.resolve,
    mergeEntered: mergeEntered.promise,
    releaseMerge: mergeRelease.resolve,
    seen,
  };
}
async function spawnOwner() {
  const child = fork(process.argv[1], ["--owner"], {
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const next = async () => {
    const [message] = await once(child, "message", {
      signal: AbortSignal.timeout(20000),
    });
    return String(message);
  };
  const exited = once(child, "exit");
  try {
    assert.equal(await next(), "ready");
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }
  return {
    start: () => {
      const result = next();
      child.send("start");
      return result;
    },
    kill: async () => {
      child.kill("SIGKILL");
      await exited;
    },
  };
}
async function concurrency(mock: Mock) {
  await seed(201);
  await sql`insert into user_upvote("contentId","userId") select f.id,u.id from feedback f cross join "user" u where f.title in ('Fixture 1','Fixture 201')`.execute(
    db,
  );
  await sql`insert into comment("postId",content,"plainText","moderationState") select id,t,t,'screened' from feedback cross join (values ('One comment'),('Updated status to planned')) c(t) where title='Fixture 1'`.execute(
    db,
  );
  await setBudget(77);
  const previous = await getInsightsQuery(),
    before = await calls(),
    gate = held(mock, true),
    child = await spawnOwner();
  const cancel = new AbortController();
  try {
    const [local, remote] = await Promise.all([
      startInsightsRun(admin, cancel.signal),
      child.start(),
    ]);
    cancel.abort();
    assert.equal(local.id, remote);
    await gate.entered();
    assert.equal((await getInsightsRun(admin))?.id, remote);
    const active = await report(remote);
    assert.equal(active.stage, "admitted");
    assert.equal(active.reservationCount, 2);
    assert.equal(await budget(remote), 80);
    assert.equal((await calls()) - before, 1);
    assert.deepEqual((await getInsightsQuery()).run, previous.run);
    const publicState = await getInsightsRun(admin, remote);
    assert.deepEqual(
      Object.keys(publicState!).sort(),
      [
        "error",
        "finishedAt",
        "id",
        "postsAnalyzed",
        "postsTotal",
        "stage",
        "startedAt",
        "status",
      ].sort(),
    );
    await sql`update feedback set title='Changed after admission' where title='Fixture 201'`.execute(
      db,
    );
    await sql`delete from user_upvote where "userId"='insight-voter'`.execute(
      db,
    );
    gate.release();
    await gate.mergeEntered;
    assert.equal((await report(remote)).reservationCount, 0);
    const started = Date.now();
    await delay(92_000);
    const after = await report(remote);
    assert.equal(after.status, "running");
    assert.equal(after.owner, active.owner);
    assert.equal(after.fence, active.fence);
    assert(
      after.heartbeatAt.getTime() - active.heartbeatAt.getTime() >= 55_000,
    );
    const expiry = await db
      .selectFrom("job_lease")
      .select("until")
      .where("name", "=", "insight:" + remote)
      .executeTakeFirstOrThrow();
    assert(expiry.until.getTime() > Date.now());
    assert.equal((await startInsightsRun(admin)).id, remote);
    gate.releaseMerge();
    await ended(remote);
    assert.equal((await calls()) - before, 3);
    assert.equal(await budget(remote), 80);
    assert.deepEqual(
      gate.seen.map((g) => g.length),
      [200, 1, 1],
    );
    assert.deepEqual(gate.seen[1], ["Fixture 201"]);
    assert.deepEqual(gate.seen[2], ["merge"]);
    const reportView = await getInsightsQuery(),
      [insight] = reportView.insights;
    assert.equal(insight.reach, 2);
    assert.equal(insight.signals?.postCount, 201);
    assert.equal(insight.signals?.commentCount, 1);
    assert.equal(insight.signals?.recentUpvotes, 4);
    return {
      heldMs: Date.now() - started,
      joinedId: remote,
      reserved: 3,
      wires: 3,
    };
  } finally {
    gate.release();
    gate.releaseMerge();
    await child.kill();
  }
}
async function rejectionCases(mock: Mock) {
  const before = await calls(),
    wire = mock.requests,
    last = await getInsightsQuery();
  await setBudget(78);
  await assert.rejects(
    startInsightsRun(admin),
    (e) =>
      e instanceof DomainError &&
      e.message === "AI_PAUSED" &&
      !!e.resetsAt &&
      (e.retryAfterSeconds ?? 0) > 0,
  );
  const refused = await getInsightsRun(admin);
  assert(refused);
  assert.equal((await ended(refused.id, "AI_PAUSED")).reservationId, null);
  assert.equal(await budget(), 78);
  assert.equal(await calls(), before);
  assert.equal(mock.requests, wire);
  for (const stage of [1, 2, 3]) {
    await setBudget(0);
    const baseline = await calls();
    let n = 0;
    mock.handler = async (request) => {
      if (++n === stage)
        json(request.response, { error: { message: privateMarker } }, 503);
      else await insightAnswer(request);
    };
    const run = await startInsightsRun(admin);
    await ended(run.id, "provider-error");
    assert.equal(n, stage);
    assert.equal((await calls()) - baseline, stage);
    assert.equal(await budget(), 3);
    assert.deepEqual(await getInsightsQuery(), last);
  }
  await setBudget(0);
  const gate = held(mock),
    base = await calls(),
    run = await startInsightsRun(admin);
  await gate.entered();
  await sql`update insight_reports set "reservationDay"=(clock_timestamp() at time zone 'UTC')::date-1 where id=${run.id}`.execute(
    db,
  );
  await sql`insert into rate_limit(key,count,"windowStart") values('ai:instance:day:'||to_char((clock_timestamp() at time zone 'UTC')::date-1,'YYYY-MM-DD'),55,clock_timestamp()-interval '1 day') on conflict(key) do update set count=55`.execute(
    db,
  );
  assert.equal(await budget(run.id), 55);
  assert.equal(await budget(), 3);
  gate.release();
  await ended(run.id, "RESERVATION_EXPIRED");
  assert.equal(gate.seen.length, 1);
  assert.equal((await calls()) - base, 1);
  assert.equal(await budget(), 3);
  assert.deepEqual(await getInsightsQuery(), last);
  for (const mode of ["empty", "single", "bad-index", "overlap"]) {
    await setBudget(0);
    let n = 0;
    mock.handler = async (request) => {
      const { merge, items } = insightRequest(request.body);
      n++;
      if (merge) {
        const groups =
          mode === "overlap"
            ? [
                [0, 1],
                [0, 1],
              ]
            : [];
        chat(request.response, 0.001, "stop", JSON.stringify({ groups }));
        return;
      }
      if (mode === "empty" || (mode === "single" && n === 2))
        chat(request.response, 0.001, "stop", '{"insights":[]}');
      else if (mode === "bad-index")
        chat(
          request.response,
          0.001,
          "stop",
          JSON.stringify({
            insights: [
              {
                title: "Wrong row",
                description: "Unknown",
                severity: 8,
                ids: [items.length + 1],
              },
            ],
          }),
        );
      else await insightAnswer(request);
    };
    const run = await startInsightsRun(admin);
    const terminal = await ended(
      run.id,
      mode === "single" || mode === "empty" ? undefined : "invalid-response",
    );
    if (mode === "empty") {
      assert.equal(terminal.insightCount, "0");
      assert.equal((await getInsightsQuery()).insights.length, 0);
    }
    assert.equal(n, mode === "bad-index" ? 1 : 3);
    assert.equal(await budget(), 3);
  }
}
async function publishFailures(mock: Mock) {
  const last = await getInsightsQuery();
  await setBudget(0);
  const gate = held(mock),
    run = await startInsightsRun(admin);
  await gate.entered();
  await saveConfiguration(admin, await configuration(), {
    options: { model: "fixture/changed" },
  });
  gate.release();
  await ended(run.id, "STALE_CONFIGURATION");
  assert.equal(gate.seen.length, 1);
  assert.equal(await budget(), 3);
  assert.deepEqual(await getInsightsQuery(), last);

  // Roll back even if the report update is the only write that fails.
  await sql`create function fixture_reject_report() returns trigger language plpgsql as $$begin raise exception 'private diagnostic'; end$$`.execute(
    db,
  );
  await sql`create trigger fixture_reject_report before update on insight_reports for each row when (new.status='succeeded') execute function fixture_reject_report()`.execute(
    db,
  );
  try {
    mock.handler = insightAnswer;
    const before = await calls(),
      failed = await startInsightsRun(admin);
    await ended(failed.id, "job-failed");
    assert.equal((await calls()) - before, 3);
    assert.deepEqual(await getInsightsQuery(), last);
  } finally {
    await sql`drop trigger fixture_reject_report on insight_reports`.execute(
      db,
    );
    await sql`drop function fixture_reject_report()`.execute(db);
  }

  // Give the old process a valid final merge response after a successor has published.
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  mock.handler = async (wire) => {
    if (insightRequest(wire.body).merge) {
      entered.resolve();
      await release.promise;
    }
    if (!wire.response.destroyed) answerInsight(wire, "Superseded theme");
  };
  const { run: old, finished } = await startInsightJob(admin);
  assert(finished);
  await Promise.race([
    entered.promise,
    delay(12000, undefined, { ref: false }).then(() => {
      throw Error("Merge never arrived");
    }),
  ]);
  try {
    await sql`update job_lease set fence=fence+1 where name=${"insight:" + old.id}`.execute(
      db,
    );
    await sql`update insight_reports set "heartbeatAt"=clock_timestamp()-interval '6 minutes' where id=${old.id}`.execute(
      db,
    );
    mock.handler = insightAnswer;
    const next = await startInsightsRun(admin);
    await ended(next.id);
    const latest = await getInsightsQuery();
    release.resolve();
    await finished;
    assert.equal(latest.insights[0].title, "Improve board navigation");
    await ended(old.id, "stale-run");
    assert.deepEqual(await getInsightsQuery(), latest);
  } finally {
    release.resolve();
  }

  const abandoned = held(mock),
    interrupted = await startInsightsRun(admin);
  await abandoned.entered();
  try {
    const active = await report(interrupted.id);
    assert(active.reservationId);
    const receipt = {
      runId: active.id,
      owner: active.owner,
      fence: active.fence,
      id: active.reservationId,
      configToken: active.configToken,
    };
    const tracked = await calls(),
      config = await configuration();
    const first = await beginAttempt(
      config,
      "insights",
      "chat",
      undefined,
      receipt,
    );
    await cancelUndispatched(first, receipt);
    assert.equal(
      (await report(active.id)).reservationCount,
      active.reservationCount,
    );
    assert.equal(await calls(), tracked);
    const withheld = await beginAttempt(
      config,
      "insights",
      "chat",
      undefined,
      receipt,
    );
    await sql`update job_lease set fence=fence+1 where name=${"insight:" + interrupted.id}`.execute(
      db,
    );
    await cancelUndispatched(withheld, receipt);
    assert.equal(await calls(), tracked);
    assert.equal(
      (await report(active.id)).reservationCount,
      active.reservationCount! - 1,
    );
    await eventually(
      async () => mock.active,
      (n) => n === 0,
      16000,
    );
    assert.equal((await report(interrupted.id)).status, "running");
    await sql`update insight_reports set "heartbeatAt"=clock_timestamp()-interval '6 minutes' where id=${interrupted.id}`.execute(
      db,
    );
    await getInsightsRun(admin);
    await ended(interrupted.id, "stale-run");
  } finally {
    abandoned.release();
  }
}
async function deathAndFencing(mock: Mock) {
  await setBudget(0);
  const gate = held(mock),
    child = await spawnOwner(),
    baseline = await calls();
  try {
    const id = await child.start();
    await gate.entered();
    await child.kill();
    assert.equal((await report(id)).status, "running");
    await sql`update insight_reports set "heartbeatAt"=clock_timestamp()-interval '6 minutes' where id=${id}`.execute(
      db,
    );
    await migrateAndSeed();
    await ended(id, "stale-run");
    assert.equal((await calls()) - baseline, 1);
    assert.equal(await budget(), 3);
    assert.equal((await getInsightsRun(admin))?.id, id);
  } finally {
    gate.release();
    await child.kill();
  }
  for (const recovery of ["read", "housekeeping", "start"]) {
    await setBudget(0);
    const last = await getInsightsQuery(),
      stalled = held(mock),
      run = await startInsightsRun(admin);
    await stalled.entered();
    await sql`update job_lease set holder='replacement-fence',fence=fence+1 where name=${"insight:" + run.id}`.execute(
      db,
    );
    await sql`update insight_reports set "heartbeatAt"=clock_timestamp()-interval '6 minutes' where id=${run.id}`.execute(
      db,
    );
    if (recovery === "housekeeping") await sweep(false);
    if (recovery === "read")
      assert.equal((await getInsightsRun(admin))?.error, "stale-run");
    mock.handler = insightAnswer;
    const replacement = await startInsightsRun(admin);
    await ended(run.id, "stale-run");
    assert.notEqual(replacement.id, run.id);
    await ended(replacement.id);
    const successful = await getInsightsQuery();
    assert(successful.run && successful.insights[0].signals?.previous);
    assert.equal(successful.insights[0].id, last.insights[0].id);
    stalled.release();
    await eventually(
      async () => mock.active,
      (n) => n === 0,
    );
    assert.equal(stalled.seen.length, 1);
    assert.equal(await budget(), 6);
    assert.deepEqual(await getInsightsQuery(), successful);
  }
  const success = await getInsightsRun(admin);
  await sql`insert into insight_reports(status,stage,"configToken",owner,fence,error) select 'failed','complete','fixture','gone',1,'stale-run' from generate_series(1,55)`.execute(
    db,
  );
  await sweep();
  assert.equal((await report(success!.id)).status, "succeeded");
  assert((await getInsightsQuery()).run);
  assert.equal(
    Number(
      (
        await db
          .selectFrom("insight_reports")
          .select((e) => e.fn.countAll().as("n"))
          .executeTakeFirstOrThrow()
      ).n,
    ),
    50,
  );
}
async function main() {
  const boot = await migrateAndSeed();
  runtimeState().authSecret = boot.authSecret;
  if (process.argv.includes("--owner")) {
    process.on("message", () => {
      void startInsightsRun(admin)
        .then((r) => process.send!(r.id))
        .catch(() => process.send!("failed"));
    });
    process.send!("ready");
    return;
  }
  const mock = await mockOpenRouter();
  try {
    await setup();
    await assert.rejects(
      startInsightsRun({ userId: "insight-voter", sessionId: "insight-voter" }),
      { code: "FORBIDDEN" },
    );
    await assert.rejects(getInsightsRun({ userId: admin.userId }), {
      code: "FORBIDDEN",
    });
    await assert.rejects(startInsightsRun(admin), {
      message: "NO_OPEN_FEEDBACK",
    });
    await db.updateTable("ai_settings").set({ enabled: false }).execute();
    await assert.rejects(startInsightsRun(admin), {
      message: "AI_NOT_CONFIGURED",
    });
    await db.updateTable("ai_settings").set({ enabled: null }).execute();
    const ticket = await beginCheck(await configuration(), {
      actor: admin,
      intent: "test-again",
    });
    await saveCheck(ticket, {
      key: "expired",
      chat: "failed",
      search: "untested",
    });
    await assert.rejects(startInsightsRun(admin), {
      message: "AI_UNAVAILABLE",
      reason: "provider-auth",
    });
    const clear = await beginCheck(await configuration(), {
      actor: admin,
      intent: "test-again",
    });
    await saveCheck(clear, { key: "valid", chat: "passed", search: "passed" });
    assert.equal(mock.requests, 0);
    assert.equal(await getInsightsRun(admin), null);
    const limits = await sizeLimits(mock);
    const concurrencyResult = await concurrency(mock);
    await rejectionCases(mock);
    await publishFailures(mock);
    await deathAndFencing(mock);
    console.log(
      "P10_OUTCOME=" +
        JSON.stringify({
          limits,
          concurrency: concurrencyResult,
          failures: [
            "admission",
            "chunk",
            "merge",
            "UTC rollover",
            "invalid result",
          ],
          recovery: [
            "process death",
            "lease theft",
            "boot",
            "read",
            "start",
            "housekeeping",
          ],
          retainedLastSuccess: true,
        }),
    );
  } finally {
    await mock.close();
    await db.destroy();
    await runtimeState().maintenancePool?.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
