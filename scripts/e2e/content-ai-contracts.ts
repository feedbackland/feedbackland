import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { db } from "../../db/db";
import { POST } from "../../app/api/feedback/create/route";
import { appRouter } from "../../trpc";
import { canImproveDraft } from "../../lib/llm/content-capabilities";
import {
  configuration,
  saveConfiguration,
  beginCheck,
  saveCheck,
} from "../../lib/llm/settings-store";
import { runtimeState } from "../../lib/runtime-state";
import { createFeedbackPostQuery } from "../../queries/create-feedback-post";
import { createCommentQuery } from "../../queries/create-comment";
import { updateFeedbackPostQuery } from "../../queries/update-feedback-post";
import { updateCommentQuery } from "../../queries/update-comment";
import { getActivityFeedQuery } from "../../queries/get-activity-feed";
import { getModerationCoverageQuery } from "../../queries/get-moderation-coverage";
import { seedUser } from "./v19-auth-invariants";
import { eventually } from "./run";
import {
  chat,
  firstKey,
  json,
  privateMarker,
  type mockOpenRouter,
  type Handler,
} from "../mock-llm";
import type { Actor } from "../../lib/auth/authorization";

type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
const allowed = JSON.stringify({
  isInappropriate: false,
  confidenceScore: 0.99,
});
const labels = { title: "Clear fixture title", category: "idea" };
const success: Handler = ({ response, body }) => {
  const system = (body.messages as { content: string }[])[0].content;
  chat(
    response,
    0.001,
    "stop",
    system.startsWith("Moderate")
      ? allowed
      : system.startsWith("Create")
        ? JSON.stringify(labels)
        : "Improved fixture draft",
  );
};
const post = (description: string, actor?: Actor, signal?: AbortSignal) =>
  createFeedbackPostQuery({
    description,
    authorId: actor?.userId ?? null,
    sessionId: actor?.sessionId,
    signal,
  });
const submit = (description: string) =>
  POST(
    new Request("http://board.invalid/api/feedback/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description }),
    }),
  );
async function gate(mock: Mock) {
  const started = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  mock.handler = async (wire) => {
    started.resolve();
    await release.promise;
    return success(wire);
  };
  return { started: started.promise, release: release.resolve };
}
async function countRows() {
  const { rows } = await sql<{
    n: number;
  }>`select ((select count(*) from feedback)+(select count(*) from comment))::integer as n`.execute(
    db,
  );
  return rows[0].n;
}
export async function contentContracts(mock: Mock, admin: Actor) {
  await db
    .updateTable("settings")
    .where("id", "=", 1)
    .set({ setupCompletedAt: new Date() })
    .execute();
  const owner = await seedUser("content-author"),
    stranger = await seedUser("content-stranger");
  const options = async (change: Parameters<typeof saveConfiguration>[2]) =>
    saveConfiguration(admin, await configuration(), change);
  const comment = (
    postId: string,
    content: string,
    parentCommentId: string | null = null,
  ) =>
    createCommentQuery({
      postId,
      content,
      parentCommentId,
      authorId: owner.userId,
      sessionId: owner.sessionId,
    });
  const feed = async () =>
    (
      await getActivityFeedQuery({
        userId: admin.userId,
        page: 1,
        pageSize: 100,
        orderBy: "newest",
        status: null,
        categories: null,
        excludeComments: false,
        excludeFeedback: false,
        searchValue: "",
        unseenOnly: false,
        unscreenedOnly: true,
      })
    ).items;
  const client = appRouter.createCaller({
    userId: null,
    userEmail: null,
    sessionId: null,
    canAdminister: false,
    ip: "192.0.2.83",
  });
  const adminClient = appRouter.createCaller({
    ...admin,
    sessionId: admin.sessionId!,
    userEmail: null,
    canAdminister: true,
    ip: "192.0.2.84",
  });
  const before = mock.requests;
  await options({
    enabled: false,
    options: { timeoutMs: 3000, dailyCallLimit: 5000, vision: true },
  });
  assert.equal(await canImproveDraft(), false);
  const plain = await post("First sentence. More words.", owner);
  assert.equal(plain.title, "First sentence.");
  assert.equal(plain.category, "general feedback");
  assert.equal(plain.moderationState, "disabled");
  assert.equal(
    (await comment(plain.id, "Keyless reply")).moderationState,
    "disabled",
  );
  assert.equal((await post("最初の文。次の文。", owner)).title, "最初の文。");
  const unicode = "🟩".repeat(81);
  assert.equal(
    (await post(unicode, owner)).title,
    Array.from(unicode).slice(0, 80).join(""),
  );
  await assert.rejects(client.rewriteFeedback({ description: "Draft" }), {
    message: "AI_NOT_CONFIGURED",
  });
  await assert.rejects(client.getModerationCoverage(), {
    code: "UNAUTHORIZED",
  });
  assert.equal(mock.requests, before);
  // An administrator can resume with a checked key after turning AI off.
  const ticket = await beginCheck(await configuration(), {
    actor: admin,
    intent: "configure",
  });
  await saveCheck(ticket, { key: "valid", chat: "passed", search: "untested" });
  await options({ enabled: true });
  mock.expectedKey = firstKey;
  mock.handler = success;
  assert(await canImproveDraft());
  const live = await post("Specific fixture suggestion.", owner);
  assert.equal(live.title, labels.title);
  assert.equal(live.category, "idea");
  assert.equal(live.moderationState, "screened");
  assert.equal(
    (await client.rewriteFeedback({ description: "This draft is unclear" }))
      .description,
    "Improved fixture draft",
  );
  const activeBefore = await countRows();
  for (const mode of ["verdict", "refusal", "filter"]) {
    mock.handler = ({ response }) =>
      mode === "refusal"
        ? json(
            response,
            {
              error: {
                metadata: { error_type: "refusal" },
                message: privateMarker,
              },
            },
            403,
          )
        : chat(
            response,
            0.001,
            mode === "filter" ? "content_filter" : "stop",
            JSON.stringify({ isInappropriate: true, confidenceScore: 0.99 }),
          );
    const reply = await submit("Decline the fixture.");
    assert.equal(reply.status, 400);
    assert.deepEqual(await reply.json(), { error: "inappropriate-content" });
  }
  assert.equal(await countRows(), activeBefore);
  // Each field falls back independently on malformed output.
  for (const [title, category, expectedTitle, expectedCategory] of [
    [null, "issue", "Fallback sentence.", "issue"],
    ["Keep this", "Idea", "Keep this", "general feedback"],
    [" ", "invalid", "Fallback sentence.", "general feedback"],
  ] as const) {
    mock.handler = (wire) =>
      (wire.body.messages as { content: string }[])[0].content.startsWith(
        "Moderate",
      )
        ? success(wire)
        : chat(
            wire.response,
            0.001,
            "stop",
            "\x60\x60\x60json\n" +
              JSON.stringify({ title, category }) +
              "\n\x60\x60\x60",
          );
    const row = await post("Fallback sentence. Additional detail.", owner);
    assert.deepEqual(
      [row.title, row.category, row.moderationState],
      [expectedTitle, expectedCategory, "screened"],
    );
  }
  mock.handler = (wire) =>
    (wire.body.messages as { content: string }[])[0].content.startsWith(
      "Moderate",
    )
      ? success(wire)
      : chat(wire.response, 0.001, "length", JSON.stringify(labels));
  const truncated = await post("Keep the fallback.", owner);
  assert.equal(truncated.title, "Keep the fallback.");
  assert.equal(truncated.category, "general feedback");
  await assert.rejects(
    client.rewriteFeedback({ description: "Truncated draft" }),
    { message: "AI_UNAVAILABLE" },
  );
  mock.handler = ({ response }) =>
    chat(response, 0.001, "stop", "{invalid verdict");
  const malformed = await post("Malformed fixture.", owner);
  assert.equal(malformed.moderationState, "unscreened");
  assert.equal(
    (await feed()).find((item) => item.id === malformed.id)?.moderationReason,
    "provider-error",
  );
  mock.handler = success;
  const baseline = await getModerationCoverageQuery();
  let eventPost = live;
  let eventComment = await comment(live.id, "Screened comment");
  const edit = (expectedRevision: string, actor: Actor = owner) =>
    updateFeedbackPostQuery({
      ...actor,
      postId: live.id,
      title: "Edited title",
      description: "Edited body",
      expectedRevision,
    });
  const editComment = (expectedRevision: string) =>
    updateCommentQuery({
      ...owner,
      commentId: eventComment.id,
      content: "Edited comment",
      expectedRevision,
    });
  for (const [status, reason] of [
    [401, "provider-auth"],
    [402, "provider-credit"],
    [429, "provider-rate"],
    [500, "provider-error"],
  ] as const) {
    mock.handler = ({ response }) =>
      json(response, { error: { message: privateMarker } }, status);
    const count = mock.requests;
    const created = await post("Outage. More detail.", owner),
      reply = await comment(
        created.id,
        "Updated status to illustrate this issue",
      );
    eventPost = await edit(eventPost.revision);
    eventComment = await editComment(eventComment.revision);
    assert.equal(mock.requests - count, 4);
    for (const row of [created, reply, eventPost, eventComment]) {
      assert.equal(row.moderationState, "unscreened");
      const event = await db
        .selectFrom("moderation_event")
        .select("reason")
        .where("contentRevision", "=", row.revision)
        .where("description" in row ? "postId" : "commentId", "=", row.id)
        .executeTakeFirstOrThrow();
      assert.equal(event.reason, reason);
    }
  }
  const unique = await feed();
  assert(
    unique.some(
      (row) =>
        row.type === "comment" && row.content.startsWith("Updated status to"),
    ),
  );
  assert.equal(new Set(unique.map((x) => x.id)).size, unique.length);
  assert.equal(unique.filter((x) => x.id === live.id).length, 1);
  assert.equal(
    unique.find((x) => x.id === live.id)?.moderationReason,
    "provider-error",
  );
  assert.deepEqual(await adminClient.getModerationCoverage(), {
    current: baseline.current + 10,
    recent: baseline.recent + 10,
  });
  mock.handler = success;
  eventPost = await edit(eventPost.revision);
  assert.equal(eventPost.moderationState, "screened");
  assert(!(await feed()).some((x) => x.id === live.id));
  assert.deepEqual(await getModerationCoverageQuery(), {
    current: baseline.current + 9,
    recent: baseline.recent + 10,
  });
  await db
    .updateTable("moderation_event")
    .where("commentId", "=", eventComment.id)
    .set({ createdAt: sql`clock_timestamp()-interval '31 days'` })
    .execute();
  await db
    .deleteFrom("moderation_event")
    .where("createdAt", "<", sql<Date>`clock_timestamp()-interval '30 days'`)
    .execute();
  assert.equal(
    (await feed()).find((x) => x.id === eventComment.id)?.moderationReason,
    null,
  );
  assert.equal(
    (await getModerationCoverageQuery()).recent,
    baseline.recent + 9,
  );
  await db.deleteFrom("comment").where("id", "=", eventComment.id).execute();
  const reported = await getModerationCoverageQuery();
  assert.equal(reported.current, baseline.current + 8);
  const withHistory = await post("Delete fixture", owner);
  mock.handler = ({ response }) => json(response, { error: {} }, 503);
  const removed = await comment(withHistory.id, "Unscreened reply");
  await db.deleteFrom("feedback").where("id", "=", withHistory.id).execute();
  assert.equal((await getModerationCoverageQuery()).recent, reported.recent);
  assert.equal(
    await db
      .selectFrom("moderation_event")
      .select("id")
      .where("commentId", "=", removed.id)
      .executeTakeFirst(),
    undefined,
  );
  mock.handler = success;
  const invalidBefore = mock.requests;
  await assert.rejects(client.rewriteFeedback({ description: "\uD800" }), {
    message: "INVALID_CONTENT_INPUT",
  });
  await assert.rejects(edit("1"), { message: "CONTENT_CHANGED" });
  await assert.rejects(edit(eventPost.revision, stranger), {
    code: "FORBIDDEN",
  });
  await assert.rejects(comment(randomUUID(), "Missing post"), {
    code: "NOT_FOUND",
  });
  await assert.rejects(comment(plain.id, "Invalid parent", randomUUID()), {
    message: "INVALID_REPLY_PARENT",
  });
  await assert.rejects(
    post('<img src="/api/images/' + randomUUID() + '">', owner),
    { code: "BAD_REQUEST" },
  );
  assert.equal(mock.requests, invalidBefore);
  let held = await gate(mock);
  const lost = assert.rejects(edit(eventPost.revision, admin), {
    code: "FORBIDDEN",
  });
  await held.started;
  await db
    .updateTable("user")
    .where("id", "=", admin.userId)
    .set({ role: "user" })
    .execute();
  held.release();
  await lost;
  await db
    .updateTable("user")
    .where("id", "=", admin.userId)
    .set({ role: "admin" })
    .execute();
  held = await gate(mock);
  const stale = assert.rejects(edit(eventPost.revision), {
    message: "CONTENT_CHANGED",
  });
  await held.started;
  mock.handler = success;
  const winner = await edit(eventPost.revision);
  held.release();
  await stale;
  assert.equal(BigInt(winner.revision), BigInt(eventPost.revision) + 1n);
  held = await gate(mock);
  const revoked = assert.rejects(post("Lost session", stranger), {
    code: "UNAUTHORIZED",
  });
  await held.started;
  await db
    .deleteFrom("auth_session")
    .where("id", "=", stranger.sessionId!)
    .execute();
  held.release();
  await revoked;
  held = await gate(mock);
  const settingsChanged = assert.rejects(edit(winner.revision), {
    message: "CONTENT_SETTINGS_CHANGED",
  });
  await held.started;
  await options({ options: { timeoutMs: 3500 } });
  held.release();
  await settingsChanged;

  mock.handler = success;
  const image = async (contentType: string, size: number) =>
    (
      await db
        .insertInto("images")
        .values({
          contentType,
          width: 1,
          height: 1,
          byteSize: size,
          bytes: Buffer.alloc(size, 1),
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  const png = await image("image/png", 1),
    gif = await image("image/gif", 32);
  const img = (id: string) => '<img src="/api/images/' + id + '">';
  const missingDuring = await image("image/png", 3);
  held = await gate(mock);
  const disappeared = assert.rejects(
    post("Removed during review" + img(missingDuring), owner),
    { code: "BAD_REQUEST" },
  );
  await held.started;
  await db.deleteFrom("images").where("id", "=", missingDuring).execute();
  held.release();
  await disappeared;
  const parentDuring = await comment(
    live.id,
    "Parent removed during screening",
  );
  held = await gate(mock);
  const orphan = assert.rejects(
    comment(live.id, "Reply during review", parentDuring.id),
    { message: "INVALID_REPLY_PARENT" },
  );
  await held.started;
  await db.deleteFrom("comment").where("id", "=", parentDuring.id).execute();
  held.release();
  await orphan;
  mock.handler = success;
  const mixed = await comment(live.id, img(png) + img(png) + img(gif));
  assert.equal(mixed.moderationState, "screened-text");
  const frames = JSON.stringify(mock.last.body.messages);
  assert.equal(frames.split("data:image/png;base64,").length - 1, 1);
  assert(!frames.includes("/api/images/"));
  assert.equal(
    (
      await db
        .selectFrom("image_ref")
        .select("imageId")
        .where("commentId", "=", mixed.id)
        .execute()
    ).length,
    2,
  );
  let attempts = 0;
  mock.handler = (wire) => {
    attempts++;
    if (attempts === 1) {
      assert(JSON.stringify(wire.body.messages).includes("data:image/"));
      json(wire.response, { error: {} }, 415);
    } else {
      assert(!JSON.stringify(wire.body.messages).includes("data:image/"));
      return success(wire);
    }
  };
  const retried = await comment(live.id, "Valid caption" + img(png));
  assert.equal(attempts, 2);
  assert.equal(retried.moderationState, "screened-text");
  assert.equal(
    (await feed()).find((x) => x.id === retried.id)?.moderationReason,
    "vision-not-screened",
  );
  mock.handler = success;
  await options({ options: { vision: false } });
  assert.equal((await post(img(png), owner)).title, "Untitled feedback");
  assert(!JSON.stringify(mock.last.body.messages).includes("data:image/"));
  await options({ options: { vision: true, timeoutMs: 15000 } });
  const large = await Promise.all(
    Array.from({ length: 4 }, () => image("image/png", 1000000)),
  );
  held = await gate(mock);
  const controller = new AbortController(),
    countBefore = await countRows();
  const first = assert.rejects(
    post(large.map(img).join(""), owner, controller.signal),
    { message: "REQUEST_CANCELLED" },
  );
  await held.started;
  const burst = await Promise.allSettled(
    Array.from({ length: 20 }, () => post(large.map(img).join(""), owner)),
  );
  assert(
    burst.every(
      (r) =>
        r.status === "rejected" &&
        r.reason.message === "VISION_BUSY" &&
        r.reason.retryAfterSeconds === 5,
    ),
  );
  assert.equal(await countRows(), countBefore);
  controller.abort();
  await first;
  held.release();
  await eventually(
    async () => mock.active,
    (n) => n === 0,
  );
  assert.equal(runtimeState().aiWork?.vision, 0);
  held = await gate(mock);
  const cancels = Array.from({ length: 8 }, () => new AbortController());
  const workers = cancels.map((c) =>
    assert.rejects(post("Slot fixture", owner, c.signal), {
      message: "REQUEST_CANCELLED",
    }),
  );
  await eventually(
    async () => mock.active,
    (n) => n === 8,
  );
  const busy = await submit("Retry fixture");
  assert.equal(busy.status, 429);
  assert.equal(busy.headers.get("retry-after"), "5");
  assert.deepEqual(await busy.json(), { error: "AI_BUSY" });
  assert.equal(await countRows(), countBefore);
  cancels.forEach((c) => c.abort());
  await Promise.all(workers);
  held.release();
  await eventually(
    async () => mock.active,
    (n) => n === 0,
  );
  mock.handler = success;
  await options({ options: { dailyCallLimit: 10, timeoutMs: 1000 } });
  const day = sql<string>`'ai:instance:day:' || to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')`;
  await db
    .updateTable("rate_limit")
    .set({ count: 8 })
    .where("key", "=", day)
    .execute();
  assert.equal(await canImproveDraft(), false);
  await assert.rejects(
    client.rewriteFeedback({ description: "Paused draft" }),
    { message: "AI_PAUSED" },
  );
  const penultimate = await submit("Still screened.");
  assert.equal(penultimate.status, 201);
  const final = await submit("Last moderation.");
  assert.equal(final.status, 201);
  const sent = mock.requests;
  const paused = await submit("Over limit");
  assert.equal(paused.status, 429);
  assert(Number(paused.headers.get("retry-after")) > 0);
  assert.deepEqual(await paused.json(), { error: "DAILY_LIMIT" });
  const signed = await post("Signed in after limit", owner);
  assert.equal(signed.moderationState, "unscreened");
  assert.equal(
    (await feed()).find((x) => x.id === signed.id)?.moderationReason,
    "daily-limit",
  );
  assert.equal(mock.requests, sent);
  await db
    .updateTable("rate_limit")
    .set({ count: 0 })
    .where("key", "=", day)
    .execute();
  mock.handler = () => {};
  const timed = await post("Provider timeout", owner);
  assert.equal(timed.moderationState, "unscreened");
  assert.equal(
    (await feed()).find((x) => x.id === timed.id)?.moderationReason,
    "provider-error",
  );
  // Simulate a restored database with a mismatched authentication secret.
  const oldSecret = runtimeState().authSecret;
  try {
    runtimeState().authSecret = "content-fixture-rotated-secret";
    delete runtimeState().aiConfig;
    assert.equal(await canImproveDraft(), false);
    const unreadable = await post("Stored key cannot be opened", owner);
    assert.equal(
      (await feed()).find((item) => item.id === unreadable.id)
        ?.moderationReason,
      "key-unreadable",
    );
  } finally {
    runtimeState().authSecret = oldSecret;
    delete runtimeState().aiConfig;
  }
  // A limiter outage still records the published revision even when counting fails.
  await sql`alter table rate_limit rename to content_fixture_limit`.execute(db);
  try {
    const degraded = await post("Counter temporarily unavailable", owner);
    assert.equal(
      (await feed()).find((item) => item.id === degraded.id)?.moderationReason,
      "limiter-error",
    );
    assert.equal(await canImproveDraft(), false);
  } finally {
    await sql`alter table content_fixture_limit rename to rate_limit`.execute(
      db,
    );
  }
  mock.reset();
  return {
    requests: mock.requests - before,
    coverage: "four write paths",
    races: "authority, revision, configuration and cancellation",
    visionBurst: burst.length,
  };
}
