import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { sql } from "kysely";
import { db, getPool } from "../../db/db";
import { locks } from "../../db/locks";
import {
  authorizeContentWrite,
  type Actor,
} from "../../lib/auth/authorization";
import { ADMIN_SESSION_MAX_AGE_MS } from "../../lib/auth/session-policy";
import { DailyBudgetError } from "../../lib/llm/errors";
import { screenContent, improveDraft } from "../../lib/llm/content";
import { configuration, saveConfiguration } from "../../lib/llm/settings-store";
import { prepareContent, commitContent } from "../../queries/content-write";
import { createFeedbackPostQuery } from "../../queries/create-feedback-post";
import { updateFeedbackPostQuery } from "../../queries/update-feedback-post";
import { createCommentQuery } from "../../queries/create-comment";
import { updateCommentQuery } from "../../queries/update-comment";
import { updateFeedbackPostStatusQuery } from "../../queries/update-feedback-post-status";
import { moderationCoverage } from "../../queries/get-moderation-coverage";
import { validateImages } from "../../lib/images/store";
import { appRouter } from "../../trpc";
import { chat, json, type mockOpenRouter } from "../mock-llm";
import { seedUser } from "./v19-auth-invariants";
import { eventually } from "./run";
type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
const clear = JSON.stringify({
  isInappropriate: false,
  confidenceScore: 1,
  titleApproved: true,
});
const labels = { title: "Specific heading", category: "idea" };
const submit = (description: string, actor: Actor) =>
  createFeedbackPostQuery({
    description,
    authorId: actor.userId,
    sessionId: actor.sessionId,
  });
function success(mock: Mock) {
  mock.handler = (wire) =>
    chat(
      wire.response,
      0.001,
      "stop",
      JSON.stringify(wire.body.messages).includes("Create a short")
        ? JSON.stringify(labels)
        : clear,
    );
}
async function hold(
  work: string,
  run: () => Promise<void>,
  params: unknown[] = [],
) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(work, params);
    await run();
  } finally {
    await client.query("rollback");
    client.release();
  }
}
async function waiting(kind: "relation" | "advisory") {
  await eventually(
    async () =>
      Number(
        (
          await getPool().query(
            "select count(*) as n from pg_stat_activity where application_name='feedbackland-app' and wait_event=$1",
            [kind],
          )
        ).rows[0].n,
      ),
    (n) => n >= 1,
    3000,
  );
}
async function authAndCancellation(admin: Actor, owner: Actor) {
  const actor = await seedUser("expiry-fixture"),
    elevated = await seedUser("age-fixture", "admin");
  const root = await submit("Owner's original body", owner);
  for (const [who, isAdmin] of [
    [actor, false],
    [elevated, true],
  ] as const) {
    const target = isAdmin
      ? {
          kind: "edit" as const,
          table: "feedback" as const,
          id: root.id,
          expectedRevision: root.revision,
        }
      : { kind: "new-post" as const };
    const input = await prepareContent({
      actor: who,
      target,
      text: "Expiry fixture",
      imageIds: [],
    });
    let reachedWrite = false;
    await db
      .updateTable("auth_session")
      .set(
        isAdmin
          ? { createdAt: new Date(Date.now() - ADMIN_SESSION_MAX_AGE_MS + 850) }
          : { expiresAt: new Date(Date.now() + 850) },
      )
      .where("id", "=", who.sessionId!)
      .execute();
    const attempt = commitContent(input, "post", async (trx) => {
      reachedWrite = true;
      const row = await trx
        .updateTable("feedback")
        .set({ plainText: "Temporary change" })
        .where("id", "=", root.id)
        .returning(["id", "revision"])
        .executeTakeFirstOrThrow();
      await delay(950);
      return row;
    });
    const rejected = assert.rejects(attempt, {
      code: isAdmin ? "FORBIDDEN" : "UNAUTHORIZED",
    });
    await rejected;
    assert(
      reachedWrite,
      "The session must be valid when the final transaction starts",
    );
    assert.equal(
      (
        await db
          .selectFrom("feedback")
          .select("plainText")
          .where("id", "=", root.id)
          .executeTakeFirstOrThrow()
      ).plainText,
      root.plainText,
    );
  }
  // A volatile select expression may be evaluated before a FOR SHARE lock is granted.
  const waitingUser = await seedUser("locked-session-fixture");
  let blocked: Promise<void> | undefined;
  await db
    .updateTable("auth_session")
    .set({ expiresAt: new Date(Date.now() + 1000) })
    .where("id", "=", waitingUser.sessionId)
    .execute();
  await hold(
    "select id from auth_session where id=$1 for update",
    async () => {
      blocked = assert.rejects(
        db
          .transaction()
          .execute((trx) => authorizeContentWrite(trx, waitingUser, true)),
        { code: "UNAUTHORIZED" },
      );
      await eventually(
        async () =>
          Number(
            (
              await getPool().query(
                "select count(*) n from pg_stat_activity where wait_event_type='Lock' and query like '%for share%'",
              )
            ).rows[0].n,
          ),
        (n) => n > 0,
        3000,
      );
      await delay(1100);
    },
    [waitingUser.sessionId],
  );
  await blocked;
  const controller = new AbortController();
  const input = await prepareContent({
    actor: admin,
    target: { kind: "new-post" },
    text: "Cancellation fixture",
    imageIds: [],
    signal: controller.signal,
  });
  await hold(
    "select pg_advisory_xact_lock($1::bigint)",
    async () => {
      const pending = assert.rejects(
        commitContent(input, "post", async () =>
          assert.fail("cancelled writer reached the insert"),
        ),
        { message: "REQUEST_CANCELLED" },
      );
      await waiting("advisory");
      controller.abort();
      await pending;
      assert.equal(
        (
          await getPool().query(
            "select pg_try_advisory_xact_lock($1::bigint) as available",
            [String(locks.membership)],
          )
        ).rows[0].available,
        true,
      );
      assert.equal(
        (
          await getPool().query(
            "select count(*)::int n from pg_stat_activity where wait_event='advisory'",
          )
        ).rows[0].n,
        0,
      );
    },
    [String(locks.images)],
  );
}
async function coverageIndexes(postId: string) {
  await db
    .transaction()
    .execute(async (trx) => {
      const baseline = Number(
        (await moderationCoverage.execute(trx)).rows[0].current,
      );
      await sql`insert into feedback(title,description,"plainText",category,"moderationState")
      select 'Index fixture','Body','Body','idea', case when n=1 then 'unscreened' else 'screened' end from generate_series(1,8000) n`.execute(
        trx,
      );
      await sql`insert into comment("postId",content,"plainText","moderationState")
      select ${postId}::uuid,'Comment index fixture','Comment index fixture',case when n=1 then 'screened-text' else 'screened' end from generate_series(1,8000) n`.execute(
        trx,
      );
      await sql`analyze feedback`.execute(trx);
      await sql`analyze comment`.execute(trx);
      const { rows } =
        await sql`explain (analyze,format json) ${moderationCoverage}`.execute(
          trx,
        );
      assert.match(JSON.stringify(rows), /feedback_pending_moderation_idx/);
      assert.match(JSON.stringify(rows), /comment_pending_moderation_idx/);
      assert.equal(
        Number((await moderationCoverage.execute(trx)).rows[0].current),
        baseline + 2,
      );
      await trx
        .updateTable("feedback")
        .set({ moderationState: "unscreened" })
        .where("title", "=", "Index fixture")
        .execute();
      await trx
        .updateTable("comment")
        .set({ moderationState: "screened-text" })
        .where("content", "=", "Comment index fixture")
        .execute();
      await sql`analyze feedback`.execute(trx);
      await sql`analyze comment`.execute(trx);
      const outage =
        await sql`explain (analyze,format json) ${moderationCoverage}`.execute(
          trx,
        );
      assert.match(JSON.stringify(outage.rows), /Scan/);
      assert.equal(
        Number((await moderationCoverage.execute(trx)).rows[0].current),
        baseline + 16000,
      );
      // Keep the large planner fixture out of subsequent checks.
      throw new Error("rollback planner fixture");
    })
    .then(
      () => assert.fail("expected rollback"),
      (error) => assert.equal(error.message, "rollback planner fixture"),
    );
}
export async function contentRegressions(
  mock: Mock,
  admin: Actor,
  owner: Actor,
) {
  const options = async (vision: boolean, timeoutMs = 1000) =>
    saveConfiguration(admin, await configuration(), {
      options: { dailyCallLimit: 5000, timeoutMs, vision },
    });
  await db
    .deleteFrom("rate_limit")
    .where("key", "like", "ai:instance:day:%")
    .execute();
  await options(true);
  success(mock);
  await authAndCancellation(admin, owner);
  await moderationDeadlinesAndRetries(mock, options);
  await outputAndHealth(mock, owner);
  await generatedHeadings(mock, owner);
  const postId = await invalidStorageText(mock, owner);
  await statusHistory(mock, admin, postId);
  await coverageIndexes(postId);
  await dailyBudgetReset();
  return "Editor-independent coverage, budgets, expiry, locks, deadlines, validation, status history and query plans passed";
}
async function moderationDeadlinesAndRetries(
  mock: Mock,
  options: (vision: boolean) => Promise<unknown>,
) {
  const asset = await db
    .insertInto("images")
    .values({
      contentType: "image/png",
      width: 1,
      height: 1,
      byteSize: 1,
      bytes: Buffer.from([1]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const metadata = await validateImages(db, [asset.id]);
  let attempts = 0;
  mock.handler = async (wire) => {
    const n = ++attempts;
    await delay(650);
    if (!wire.response.destroyed) {
      if (n === 1) json(wire.response, { error: {} }, 415);
      else chat(wire.response, 0.001, "stop", clear);
    }
  };
  const slow = await screenContent("Delayed caption", metadata, false);
  assert.equal(slow.coverage.state, "unscreened");
  assert.equal(attempts, 2);
  await hold("lock table rate_limit in access exclusive mode", async () => {
    const before = mock.requests;
    const result = await screenContent("Delayed budget", [], true);
    assert.equal(result.coverage.state, "unscreened");
    assert.equal(mock.requests, before);
  });
  let queued: Promise<void> | undefined;
  for (const vision of [false, true]) {
    await hold("lock table rate_limit in access exclusive mode", async () => {
      const before = mock.requests;
      const rejected = assert.rejects(
        screenContent("Settings fixture", metadata, true),
        { message: "CONTENT_SETTINGS_CHANGED" },
      );
      await waiting("relation");
      await options(vision);
      // The guarded request resumes after the lock is released.
      queued = rejected.then(() => {
        assert.equal(mock.requests, before);
      });
    });
    await queued;
  }
  let initial = 0;
  mock.handler = (wire) =>
    ++initial === 1
      ? json(wire.response, { error: {} }, 422)
      : chat(wire.response, 0.001, "stop", clear);
  assert.equal(
    (await screenContent("Plain input", [], true)).coverage.state,
    "screened",
  );
  assert.equal(initial, 2);
  initial = 0;
  mock.handler = (wire) => {
    initial++;
    json(wire.response, { error: {} }, 400);
  };
  assert.equal(
    (await screenContent("Plain repeated error", [], true)).coverage.state,
    "unscreened",
  );
  assert.equal(initial, 2);
}
async function outputAndHealth(mock: Mock, owner: Actor) {
  const usage = async (feature: string) =>
    (
      await db
        .selectFrom("llm_usage")
        .select("errors")
        .where("feature", "=", feature)
        .executeTakeFirst()
    )?.errors ?? 0;
  const config = await configuration();
  const health = () =>
    db
      .selectFrom("ai_health")
      .selectAll()
      .where("configToken", "=", config.token)
      .where("capability", "=", "chat")
      .executeTakeFirstOrThrow();
  const errors = await usage("rewrite");
  const previousHealth = await health();
  mock.handler = ({ response }) => chat(response, 0.001, "stop", "  ");
  await assert.rejects(improveDraft("Improve this"), {
    message: "AI_UNAVAILABLE",
  });
  assert.equal(await usage("rewrite"), errors + 1);
  const failedHealth = await health();
  assert.equal(failedHealth.lastReason, "provider-error");
  assert.deepEqual(failedHealth.lastSuccessAt, previousHealth.lastSuccessAt);
  assert(failedHealth.lastFailureAt && failedHealth.failingSince);
  const titleErrors = await usage("title");
  mock.handler = (wire) =>
    chat(
      wire.response,
      0.001,
      "stop",
      JSON.stringify(wire.body.messages).includes("Create a short")
        ? "malformed"
        : clear,
    );
  assert.equal(
    (await submit("Fallback title.", owner)).title,
    "Fallback title.",
  );
  assert.equal(await usage("title"), titleErrors + 1);
  for (const reason of ["provider-credit", "provider-rate", "provider-auth"]) {
    await db
      .updateTable("ai_health")
      .set({
        lastReason: reason,
        failingSince: new Date(Date.now() - 16 * 60000),
        lastFailureAt: new Date(),
      })
      .where("configToken", "=", config.token)
      .where("capability", "=", "chat")
      .execute();
    const before = mock.requests;
    const item = await submit("Outage fixture", owner);
    const event = await db
      .selectFrom("moderation_event")
      .select("reason")
      .where("postId", "=", item.id)
      .executeTakeFirstOrThrow();
    assert.equal(event.reason, reason);
    assert.equal(mock.requests, before);
  }
  await db
    .updateTable("ai_health")
    .set({ failingSince: null, lastReason: null })
    .where("configToken", "=", config.token)
    .execute();
}
async function generatedHeadings(mock: Mock, owner: Actor) {
  for (const approved of [true, false, undefined]) {
    let reviewed = false;
    mock.handler = (wire) => {
      const messages = wire.body.messages as { content: string }[];
      if (messages[0].content.startsWith("Create"))
        return chat(wire.response, 0.001, "stop", JSON.stringify(labels));
      assert(messages[1].content.includes(labels.title));
      assert(messages[1].content.includes("Original body."));
      reviewed = true;
      chat(
        wire.response,
        0.001,
        "stop",
        JSON.stringify({
          isInappropriate: false,
          confidenceScore: 1,
          titleApproved: approved,
        }),
      );
    };
    const post = await submit("Original body.", owner);
    assert(reviewed);
    assert.equal(post.title, approved ? labels.title : "Original body.");
    assert.equal(post.moderationState, "screened");
    assert.equal(post.category, "idea");
  }
}
async function invalidStorageText(mock: Mock, owner: Actor) {
  success(mock);
  const post = await submit("Persistable", owner);
  const comment = await createCommentQuery({
    postId: post.id,
    parentCommentId: null,
    authorId: owner.userId,
    sessionId: owner.sessionId,
    content: "Persistable",
  });
  const before = mock.requests;
  const counts = async () =>
    (
      await sql`select (select count(*) from feedback) as posts, (select count(*) from comment) as comments, (select revision from feedback where id=${post.id}) as post_revision, (select revision from comment where id=${comment.id}) as comment_revision`.execute(
        db,
      )
    ).rows[0];
  const original = await counts();
  for (const invalid of ["Invalid\u0000text", "Unpaired\ud800"]) {
    for (const write of [
      () => submit(invalid, owner),
      () =>
        createFeedbackPostQuery({
          authorId: null,
          sessionId: null,
          description: invalid,
          descriptionFormat: "plain-text",
        }),
      () =>
        updateFeedbackPostQuery({
          ...owner,
          postId: post.id,
          title: invalid,
          description: "Body",
          expectedRevision: post.revision,
        }),
      () =>
        updateFeedbackPostQuery({
          ...owner,
          postId: post.id,
          title: "Title",
          description: invalid,
          expectedRevision: post.revision,
        }),
      () =>
        createCommentQuery({
          postId: post.id,
          parentCommentId: null,
          authorId: owner.userId,
          sessionId: owner.sessionId,
          content: invalid,
        }),
      () =>
        updateCommentQuery({
          ...owner,
          commentId: comment.id,
          expectedRevision: comment.revision,
          content: invalid,
        }),
    ])
      await assert.rejects(write, { message: "INVALID_CONTENT_INPUT" });
  }
  assert.deepEqual(await counts(), original);
  assert.equal(mock.requests, before);
  return post.id;
}
async function statusHistory(mock: Mock, admin: Actor, postId: string) {
  const before = mock.requests;
  const change = (status: "planned" | "done" | null) =>
    updateFeedbackPostStatusQuery({ ...admin, postId, status });
  await Promise.all([change("planned"), change("planned")]);
  await change(null);
  const history = await db
    .selectFrom("comment")
    .select(["plainText", "moderationState"])
    .where("postId", "=", postId)
    .where("content", "like", "Updated status to%")
    .orderBy("createdAt")
    .execute();
  assert.deepEqual(
    history.map((c) => c.plainText),
    ["Updated status to planned", "Updated status to none"],
  );
  assert.equal(mock.requests, before);
  await sql`alter table comment add constraint status_history_fixture check ("plainText" <> 'Updated status to done') not valid`.execute(
    db,
  );
  try {
    await assert.rejects(change("done"), { code: "23514" });
    assert.equal(
      (
        await db
          .selectFrom("feedback")
          .select("status")
          .where("id", "=", postId)
          .executeTakeFirstOrThrow()
      ).status,
      null,
    );
  } finally {
    await sql`alter table comment drop constraint status_history_fixture`.execute(
      db,
    );
  }
}
async function dailyBudgetReset() {
  const midnight = new DailyBudgetError({
    day: "2028-02-29",
    now: new Date("2028-02-29T23:59:59.500Z"),
  });
  assert.equal(midnight.resetsAt, "2028-03-01T00:00:00.000Z");
  assert.equal(midnight.retryAfterSeconds, 1);
  const headers = new Headers();
  const caller = appRouter.createCaller({
    ip: "192.0.2.222",
    userId: null,
    userEmail: null,
    sessionId: null,
    canAdminister: false,
    responseHeaders: headers,
  });
  await db
    .updateTable("rate_limit")
    .set({ count: 5000 })
    .where("key", "like", "ai:instance:day:%")
    .execute();
  for (const [task, code] of [
    [
      () => caller.createFeedbackPost({ description: "Over budget" }),
      "DAILY_LIMIT",
    ],
    [
      () => caller.rewriteFeedback({ description: "Budget draft" }),
      "AI_PAUSED",
    ],
  ] as const) {
    await assert.rejects(
      task(),
      (e) =>
        e instanceof Error &&
        e.message === code &&
        typeof (e.cause as { resetsAt?: string })?.resetsAt === "string",
    );
    assert(Number(headers.get("Retry-After")) > 0);
  }
}
