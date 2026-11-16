import assert from "node:assert/strict";
import { searchTicket as cap } from "./search-ticket";
import { setTimeout as delay } from "node:timers/promises";
import { sql } from "kysely";
import { db } from "../../db/db";
import { runtimeState } from "../../lib/runtime-state";
import {
  indexSnapshot,
  guardIndex,
  rebuildIndex,
  writeVectors,
  type IndexRow,
} from "../../lib/llm/search-index";
import {
  probeIndex,
  usableIndex,
  backfillBatch,
  embedCommitted,
} from "../../lib/llm/embeddings";
import {
  saveConfiguration,
  configuration,
  beginCheck,
  beginCreditWait,
} from "../../lib/llm/settings-store";
import { acquireLease, requireLease } from "../../lib/jobs/leases";
import { maintenanceDiagnostics } from "../../lib/jobs/maintenance";
import { searchPage } from "../../lib/search/sessions";
import {
  materialize,
  prepareSemanticScan,
  semanticCandidates,
} from "../../lib/search/candidates";
import { createFeedbackPostQuery } from "../../queries/create-feedback-post";
import { createCommentQuery } from "../../queries/create-comment";
import { updateFeedbackPostQuery } from "../../queries/update-feedback-post";
import { updateCommentQuery } from "../../queries/update-comment";
import { getFeedbackPostsQuery } from "../../queries/get-feedback-posts";
import { callEmbeddings } from "../../lib/llm/client";
import { prepareEmbedding } from "../../lib/llm/model-profiles";
import {
  firstKey,
  secondKey,
  json,
  chat,
  type mockOpenRouter,
} from "../mock-llm";
import type { Actor } from "../../lib/auth/authorization";
type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;

const filters = { orderBy: "newest" as const, status: null };
const query = {
  surface: "board" as const,
  userId: null,
  filters,
  text: "Search needle",
  limit: 17,
};
async function counters() {
  await db
    .deleteFrom("rate_limit")
    .where("key", "like", "ai:instance:day:%")
    .execute();
}
function vectors(mock: Mock) {
  const defaults = mock.handler;
  mock.handler = (wire) => {
    if (wire.url !== "/api/v1/embeddings") return defaults(wire);
    const inputs = wire.body.input as string[],
      n = Number(wire.body.dimensions);
    if (inputs.some((s) => s.includes("Bad fixture row")))
      return json(wire.response, { error: {} }, 400);
    json(wire.response, {
      model: "fixture",
      data: inputs.map((_, index) => ({ index, embedding: Array(n).fill(1) })),
      usage: { prompt_tokens: 4, total_tokens: 4, cost: 0.000001 },
    });
  };
}
export async function durableSearchContracts(mock: Mock, admin: Actor) {
  await counters();
  mock.reset();
  mock.expectedKey = firstKey;
  await saveConfiguration(admin, await configuration(), {
    options: {
      timeoutMs: 120000,
      embeddingModel: "openai/text-embedding-3-small",
      dailyCallLimit: 5000,
    },
  });
  const [a, b] = await Promise.all([indexSnapshot(true), indexSnapshot(true)]);
  assert.equal(a.epoch, b.epoch);
  assert.equal(a.fingerprint?.generation, "1");
  assert(a.physical);
  const before = mock.requests;
  vectors(mock);
  await Promise.all([probeIndex(a), probeIndex(b)]);
  assert(
    usableIndex(a),
    runtimeState().embeddingProbe?.reason ?? "missing probe",
  );
  assert.equal(mock.requests, before + 1);
  const embeddings = mock.handler;
  mock.handler = (wire) =>
    wire.url === "/api/v1/chat/completions"
      ? chat(
          wire.response,
          0.001,
          "stop",
          JSON.stringify(wire.body.messages).includes("Create a short")
            ? JSON.stringify({ title: "Immediate", category: "idea" })
            : JSON.stringify({
                isInappropriate: false,
                confidenceScore: 1,
                titleApproved: true,
              }),
        )
      : embeddings(wire);
  const usage = async () =>
    Number(
      (
        await db
          .selectFrom("llm_usage")
          .select((eb) => eb.fn.sum("calls").as("n"))
          .where("feature", "=", "embed-write")
          .executeTakeFirstOrThrow()
      ).n,
    );
  const starting = await usage();
  const postWrite = await createFeedbackPostQuery({
    authorId: admin.userId,
    sessionId: admin.sessionId,
    description: "Immediate feedback",
  });
  const commentWrite = await createCommentQuery({
    authorId: admin.userId,
    sessionId: admin.sessionId,
    postId: postWrite.id,
    parentCommentId: null,
    content: "Immediate reply",
  });
  await Promise.all(runtimeState().activeEmbeddingWrites ?? []);
  await updateFeedbackPostQuery({
    ...admin,
    postId: postWrite.id,
    title: "Edited heading",
    description: "Edited body",
    expectedRevision: postWrite.revision,
  });
  await updateCommentQuery({
    ...admin,
    commentId: commentWrite.id,
    content: "Edited reply",
    expectedRevision: commentWrite.revision,
  });
  await Promise.all(runtimeState().activeEmbeddingWrites ?? []);
  assert.equal(await usage(), starting + 4);
  for (const [table, id] of [
    ["feedback", postWrite.id],
    ["comment", commentWrite.id],
  ] as const) {
    const saved = await db
      .selectFrom(table)
      .select(["embedding", "revision"])
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    assert(saved.embedding);
    assert.equal(saved.revision, "2");
  }
  await sql`insert into feedback(title,description,"plainText",category,status,"moderationState",embedding) select 'Indexed fixture','Body','Body','idea','planned','screened',
    ('['||(1+(n%44)::float/200)||',1,1]')::vector from generate_series(1,235)n`.execute(
    db,
  );
  const post = await db
    .insertInto("feedback")
    .values({
      title: "Search needle",
      description: "Exact",
      plainText: "Exact",
      status: "planned",
      moderationState: "screened",
      embeddingSkipped: true,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  await sql`insert into comment(id,"postId",content,"plainText","moderationState",embedding) values(${post.id},${post.id},'Search needle reply','Search needle reply','screened',null)`.execute(
    db,
  );
  await sql`analyze feedback`.execute(db);
  await db.transaction().execute(async (trx) => {
    await sql`set local enable_seqscan=off`.execute(trx);
    const cap = await prepareSemanticScan(trx, a.physical!.version);
    const scan = await sql<{
      ordering: string;
      budget: string;
    }>`select current_setting('hnsw.iterative_scan') as ordering,
      current_setting('hnsw.max_scan_tuples') as budget`.execute(trx);
    assert.deepEqual(scan.rows[0], {
      ordering: "strict_order",
      budget: "20000",
    });
    const compiled = semanticCandidates(
      { ...query, filters: { ...filters, status: "planned" } },
      { physical: a.physical!, vector: [1, 1, 1], maxDistance: 0.55 },
      cap + 1,
    )!;
    const plan = await sql`explain (format json) ${compiled}`.execute(trx);
    assert.match(JSON.stringify(plan.rows), /feedback_embedding_idx/);
  });
  const scope = {
    ...query,
    surface: "activity" as const,
    userId: admin.userId,
    actor: admin,
    capability: cap(),
  };
  const handler = mock.handler;
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  mock.handler = async (wire) => {
    entered.resolve();
    await release.promise;
    return handler(wire);
  };
  const paid = mock.requests;
  const building = searchPage(scope);
  try {
    await entered.promise;
    assert.equal((await searchPage(scope)).search.status, "pending");
  } finally {
    release.resolve();
  }
  let page = await building;
  assert.equal(page.search.mode, "semantic");
  assert(page.nextCursor);
  assert(page.search.total > 200);
  const originalCursor = page.nextCursor;
  mock.handler = (wire) => json(wire.response, { error: {} }, 503);
  await db
    .updateTable("rate_limit")
    .set({ count: 5000 })
    .where("key", "like", "ai:instance:day:%")
    .execute();
  const captured = [...page.entries];
  while (page.nextCursor) {
    page = await searchPage({ ...scope, cursor: page.nextCursor });
    captured.push(...page.entries);
  }
  assert.equal(mock.requests, paid + 1);
  assert.equal(
    new Set(captured.map(([kind, id]) => kind + id)).size,
    captured.length,
  );
  assert.deepEqual(
    captured
      .filter((x) => x[1] === post.id)
      .map((x) => x[0])
      .sort(),
    ["comment", "post"],
  );
  const semantic = captured.filter((x) => x[2] !== null);
  assert.deepEqual(
    semantic,
    [...semantic].sort(
      (l, r) =>
        l[2]! - r[2]! || l[0].localeCompare(r[0]) || l[1].localeCompare(r[1]),
    ),
  );
  assert(captured.slice(semantic.length).every((e) => e[2] === null));
  await assert.rejects(
    searchPage({ ...scope, text: "changed query", cursor: originalCursor }),
    { message: "SEARCH_RESTART_REQUIRED" },
  );
  await assert.rejects(
    searchPage({
      ...scope,
      filters: { ...filters, unseenOnly: true },
      cursor: originalCursor,
    }),
    { message: "SEARCH_RESTART_REQUIRED" },
  );
  await assert.rejects(
    searchPage({
      ...scope,
      actor: { userId: "different" },
      cursor: originalCursor,
    }),
    { code: "FORBIDDEN" },
  );
  const exact = await searchPage({ ...query, capability: cap() });
  assert.equal(exact.search.mode, "exact");
  assert(exact.entries.some((e) => e[1] === post.id));
  await sql`insert into feedback(title,description,"plainText","moderationState","embeddingSkipped") select \'Truncation fixture \'||n,\'Body\',\'Body\',\'disabled\',true from generate_series(1,1005)n`.execute(
    db,
  );
  const bounded = await searchPage({
    ...query,
    text: "Truncation fixture",
    capability: cap(),
  });
  assert.equal(bounded.search.total, 1000);
  assert(bounded.search.truncated);
  await db.transaction().execute(async (trx) => {
    // Exercise the pre-0.8 query path on this server using its non-iterative scan.
    await sql`update feedback set embedding=('[1,'||(1+substring(title from '[0-9]+$')::float/2000)||',1]')::vector,"embeddingSkipped"=false where title like 'Truncation fixture %'`.execute(
      trx,
    );
    const legacy = await materialize(trx, query, "No lexical match", {
      vector: [1, 1, 1],
      physical: { ...a.physical!, version: "0.7.4" },
      maxDistance: 0.55,
    });
    const mode = await sql<{
      ef: string;
    }>`select current_setting('hnsw.ef_search') as ef`.execute(trx);
    assert.equal(mode.rows[0].ef, "400");
    assert.equal(legacy.results.length, 400);
    assert(legacy.truncated);
  });
  await sql`delete from feedback where title like \'Truncation fixture %\'`.execute(
    db,
  );
  await counters();
  mock.reset();
  vectors(mock);
  await db
    .updateTable("feedback")
    .set({ embeddingSkipped: true })
    .where("embedding", "is", null)
    .execute();
  await db
    .updateTable("comment")
    .set({ embeddingSkipped: true })
    .where("embedding", "is", null)
    .execute();
  const long = "龘 ".repeat(3000),
    rows = await db
      .insertInto("comment")
      .values(
        [long, "Bad fixture row", "", "Ordinary fixture"].map((plainText) => ({
          postId: post.id,
          plainText,
          moderationState: "screened",
          content: plainText || "<p></p>",
        })),
      )
      .returning(["id", "revision", "plainText"])
      .execute();
  const owner = await acquireLease("ai-maintenance");
  assert(owner);
  try {
    assert.equal(await acquireLease("ai-maintenance"), null);
    await backfillBatch(a, owner.lease, owner.signal);
    for (const row of rows) {
      const saved = await db
        .selectFrom("comment")
        .select(["embedding", "embeddingSkipped"])
        .where("id", "=", row.id)
        .executeTakeFirstOrThrow();
      assert.equal(
        saved.embeddingSkipped,
        !row.plainText || row.plainText === "Bad fixture row",
      );
      assert.equal(!!saved.embedding, !saved.embeddingSkipped);
    }
    assert(
      prepareEmbedding(a.config.options.embeddingModel, long)!.tokens <= 8000,
    );
    const stale: IndexRow = { ...rows[0], kind: "comment", text: long };
    await db
      .updateTable("comment")
      .set({ revision: sql`revision+1`, embedding: null })
      .where("id", "=", stale.id)
      .execute();
    assert.equal(
      await writeVectors(a, [stale], [[1, 1, 1]], undefined, owner.lease),
      0,
    );
    await embedCommitted({ ...stale, revision: "2" });
    assert(
      (
        await db
          .selectFrom("comment")
          .select("embedding")
          .where("id", "=", stale.id)
          .executeTakeFirstOrThrow()
      ).embedding,
    );
    // Exercise an actual >90-second provider request while the heartbeat uses the reserved connection.
    const held = Promise.withResolvers<void>(),
      finish = Promise.withResolvers<void>();
    const normal = mock.handler;
    mock.handler = async (wire) => {
      held.resolve();
      await finish.promise;
      return normal(wire);
    };
    await db
      .updateTable("comment")
      .set({ embedding: null })
      .where("id", "=", stale.id)
      .execute();
    const batchCalls = mock.requests;
    const jobs = backfillBatch(a, owner.lease, owner.signal);
    try {
      await held.promise;
      await delay(91000);
      assert.equal(await acquireLease("ai-maintenance"), null);
    } finally {
      finish.resolve();
    }
    assert.equal(await jobs, 1);
    assert.equal(mock.requests, batchCalls + 1);
    mock.handler = normal;
    await db
      .updateTable("job_lease")
      .set({ until: new Date(0) })
      .where("name", "=", "ai-maintenance")
      .execute();
    const next = await acquireLease("ai-maintenance");
    assert(next);
    assert(BigInt(next.lease.fence) > BigInt(owner.lease.fence));
    try {
      const spent = mock.requests;
      await assert.rejects(
        writeVectors(a, [stale], [[1, 1, 1]], undefined, owner.lease),
        { reason: "RESERVATION_EXPIRED" },
      );
      await assert.rejects(
        db.transaction().execute((trx) => requireLease(trx, owner.lease)),
      );
      await assert.rejects(
        callEmbeddings("backfill", ["Expired holder"], { lease: owner.lease }),
        { reason: "RESERVATION_EXPIRED" },
      );
      assert.equal(mock.requests, spent);
    } finally {
      await next.release();
    }
  } finally {
    await owner.release();
  }
  const forced = process.env.AI_EMBEDDING_DIMENSIONS;
  try {
    await assert.rejects(
      rebuildIndex(admin, {
        epoch: a.epoch,
        token: a.config.token,
        dimensions: 12,
      }),
      { message: "INVALID_INDEX_WIDTH" },
    );
    delete process.env.AI_EMBEDDING_DIMENSIONS;
    await assert.rejects(
      rebuildIndex(
        { userId: "visitor" },
        { epoch: a.epoch, token: a.config.token, dimensions: 12 },
      ),
      { code: "FORBIDDEN" },
    );
    await sql`create view p09_width_fixture as select embedding from comment`.execute(
      db,
    );
    try {
      await assert.rejects(
        rebuildIndex(admin, {
          epoch: a.epoch,
          token: a.config.token,
          dimensions: 12,
        }),
        { code: "0A000" },
      );
      const rolled = await indexSnapshot(false);
      assert.equal(rolled.epoch, a.epoch);
      assert.equal(rolled.physical?.dimensions, 3);
      assert(
        Number(
          (
            await sql<{
              n: string;
            }>`select count(*) n from feedback where embedding is not null`.execute(
              db,
            )
          ).rows[0].n,
        ) > 200,
      );
    } finally {
      await sql`drop view p09_width_fixture`.execute(db);
    }
    await rebuildIndex(admin, {
      epoch: a.epoch,
      token: a.config.token,
      dimensions: 12,
    });
    const fresh = await indexSnapshot(false);
    assert.equal(fresh.physical?.dimensions, 12);
    assert.equal(fresh.fingerprint?.generation, "2");
    assert(!usableIndex(fresh));
    await assert.rejects(
      db.transaction().execute((trx) => guardIndex(trx, a)),
      { reason: "STALE_CONFIGURATION" },
    );
    await assert.rejects(searchPage({ ...scope, cursor: originalCursor }), {
      message: "SEARCH_RESTART_REQUIRED",
    });
    assert.equal(
      (
        await searchPage({
          ...query,
          capability: exact.search.capability,
          cursor: { capability: exact.search.capability, nextOrdinal: 0 },
        })
      ).search.mode,
      "exact",
    );
    const correct = mock.handler;
    mock.handler = (wire) =>
      json(wire.response, {
        model: "fixture",
        data: [{ index: 0, embedding: [1, 1] }],
        usage: { prompt_tokens: 4 },
      });
    await probeIndex(fresh);
    assert(!usableIndex(fresh));
    assert.equal(runtimeState().embeddingProbe?.actual, 2);
    const fallback = await searchPage({ ...query, capability: cap() });
    assert.equal(fallback.search.mode, "exact");
    mock.handler = correct;
    await delay(5100);
    await probeIndex(fresh);
    assert(usableIndex(fresh));
    await saveConfiguration(admin, await configuration(), {
      options: { embeddingModel: "openai/text-embedding-3-large" },
    });
    const changed = await indexSnapshot(true);
    assert.equal(changed.reason, "rebuild-required");
    const idle = mock.requests;
    await probeIndex(changed);
    assert.equal(mock.requests, idle);
    await rebuildIndex(admin, {
      epoch: changed.epoch,
      token: changed.config.token,
      dimensions: 12,
    });
    const rebuilt = await indexSnapshot(false);
    assert.equal(rebuilt.fingerprint?.model, "openai/text-embedding-3-large");
    await probeIndex(rebuilt);
    assert(usableIndex(rebuilt));
    await saveConfiguration(admin, await configuration(), {
      options: { embeddingModel: "fixture/unknown" },
    });
    const unknown = await indexSnapshot(true);
    assert.equal(unknown.reason, "UNSUPPORTED_EMBEDDING_TOKENIZER");
    const expired = exact.search.capability;
    await sql`update search_session set "expiresAt"=clock_timestamp()-interval '1 second' where "capabilityHash"=encode(sha256(convert_to(${expired},'UTF8')),'hex')`.execute(
      db,
    );
    await assert.rejects(
      searchPage({ ...query, cursor: { capability: expired, nextOrdinal: 0 } }),
      { message: "SEARCH_RESTART_REQUIRED" },
    );
    await sql`insert into search_session("capabilityHash","queryHash",surface,mode,status) select 'capacity-fixture-'||n,'fixture','board','exact','ready' from generate_series(1,1000)n`.execute(
      db,
    );
    try {
      await assert.rejects(searchPage({ ...query, capability: cap() }), {
        message: "SEARCH_BUSY",
      });
    } finally {
      await db
        .deleteFrom("search_session")
        .where("queryHash", "=", "fixture")
        .execute();
    }
    await saveConfiguration(admin, await configuration(), {
      apiKey: secondKey,
      options: { embeddingModel: "none" },
    });
    mock.expectedKey = secondKey;
    mock.reset();
    const pending = await configuration(),
      ticket = await beginCheck(pending, { actor: admin, intent: "configure" });
    assert(await beginCreditWait(ticket));
    const leadership = await acquireLease("ai-maintenance");
    assert(leadership);
    try {
      await maintenanceDiagnostics(await indexSnapshot(false), leadership);
      assert((await configuration()).configured);
    } finally {
      await leadership.release();
    }
    const ordinary = await getFeedbackPostsQuery({
      orderBy: "newest",
      status: null,
      searchValue: "Search needle",
      capability: cap(),
      limit: 20,
    });
    assert.equal(ordinary.search?.mode, "exact");
  } finally {
    if (forced !== undefined) process.env.AI_EMBEDDING_DIMENSIONS = forced;
    delete runtimeState().aiConfig;
  }
  return {
    indexedCandidates: semantic.length,
    tiers: "mixed posts/comments and unindexed exact",
    snapshot: "one paid request, immutable ordinal pages",
    lease: "91-second renewable dispatch and fenced takeover",
    backfill: "token bounds, poison split and revision fencing",
    capacity: 1000,
  };
}
