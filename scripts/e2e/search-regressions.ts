import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { sql } from "kysely";
import { db, getPool } from "../../db/db";
import { physicalVector } from "../../db/vector";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { acquireLease } from "../../lib/jobs/leases";
import { maintenanceDiagnostics } from "../../lib/jobs/maintenance";
import { callChat } from "../../lib/llm/client";
import {
  backfillBatch,
  embeddingsAvailable,
  probeIndex,
  probeInfo,
  usableIndex,
} from "../../lib/llm/embeddings";
import { indexSnapshot, rebuildIndex } from "../../lib/llm/search-index";
import {
  beginCheck,
  configuration,
  saveCheck,
  saveConfiguration,
  unhealthyCapabilities,
} from "../../lib/llm/settings-store";
import { validCosineVector } from "../../lib/vector-values";
import { readStoredPage, searchPage } from "../../lib/search/sessions";
import { requireSearchBody } from "../../lib/search/transport";
import { materialize, type SearchScope } from "../../lib/search/candidates";
import { sweep } from "../../lib/housekeeping";
import { updateFeedbackPostQuery } from "../../queries/update-feedback-post";
import { createFeedbackPostQuery } from "../../queries/create-feedback-post";
import { json, mockOpenRouter } from "../mock-llm";
import { eventually } from "./run";
import { searchTicket } from "./search-ticket";
import { maintenanceRegressions } from "./search-maintenance-regressions";

type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
const admin = { userId: "search-admin", sessionId: "search-session" };
const board: SearchScope = {
  surface: "board",
  userId: null,
  filters: { orderBy: "newest", status: null },
};
const search = (text: string, capability = searchTicket()) =>
  searchPage({ ...board, text, limit: 20, capability });
const checked = async (key: "valid" | "invalid" | "management" | "expired") => {
  const ticket = await beginCheck(await configuration(), {
    actor: admin,
    intent: "test-again",
  });
  assert(
    await saveCheck(ticket, {
      key,
      chat: key === "valid" ? "passed" : "failed",
      search: "passed",
    }),
  );
};
const resetBudget = () =>
  db
    .deleteFrom("rate_limit")
    .where("key", "like", "ai:instance:day:%")
    .execute();
const clearContent = () => db.deleteFrom("feedback").execute();
const indexed = async () =>
  Number(
    (
      await db
        .selectFrom("feedback")
        .select((eb) => eb.fn.countAll().as("n"))
        .where("embedding", "is not", null)
        .executeTakeFirstOrThrow()
    ).n,
  );
async function seed(n: number) {
  await sql`insert into feedback(title,description,"plainText","moderationState")
    select 'Review '||n,'Body','Content '||n,'screened' from generate_series(1,${n}::int)n`.execute(
    db,
  );
}
async function admissionAndIdentity(mock: Mock) {
  await assert.rejects(search("unclaimed"), {
    code: "FORBIDDEN",
    message: "SETUP_REQUIRED",
  });
  assert.equal(mock.requests, 0);
  assert.equal(
    Number(
      (
        await db
          .selectFrom("search_session")
          .select((eb) => eb.fn.countAll().as("n"))
          .executeTakeFirstOrThrow()
      ).n,
    ),
    0,
  );
  for (const input of [
    { searchValue: "words" },
    { searchValue: "", capability: searchTicket() },
    { searchValue: "", cursor: { capability: searchTicket(), nextOrdinal: 1 } },
  ]) {
    assert.throws(() => requireSearchBody("GET", input), {
      code: "METHOD_NOT_SUPPORTED",
    });
    requireSearchBody("POST", input);
  }
  requireSearchBody("GET", { searchValue: "", cursor: 2 });
  await db
    .updateTable("settings")
    .set({ setupCompletedAt: new Date() })
    .execute();
  await db
    .insertInto("user")
    .values({
      id: admin.userId,
      email: "search@fixture.invalid",
      name: "Search",
      emailVerified: true,
      role: "admin",
    })
    .execute();
  await db
    .insertInto("auth_session")
    .values({
      id: admin.sessionId,
      token: "search-fixture-session",
      userId: admin.userId,
      scope: "first-party",
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    .execute();
  // Preserve the actual credential result over initialization and subsequent rebuilds.
  for (const [i, key] of (
    ["invalid", "management", "expired", "valid"] as const
  ).entries()) {
    await checked(key);
    const prev = await indexSnapshot(false);
    if (i === 0) await indexSnapshot(true);
    else
      await rebuildIndex(admin, {
        epoch: prev.epoch,
        token: prev.config.token,
        dimensions: 768,
      });
    const cur = await indexSnapshot(false);
    assert.equal(cur.config.check?.key, key);
    assert.equal(cur.config.check?.chat, key === "valid" ? "passed" : "failed");
    assert.equal(cur.config.check?.search, "untested");
    assert.equal(cur.config.revision, prev.config.revision);
    if (key !== "valid") {
      const count: number = mock.requests;
      await assert.rejects(
        callChat("rewrite", { system: "Reply", text: "test" }),
        { reason: "AI_UNAVAILABLE" },
      );
      assert.equal(mock.requests, count);
    }
  }
  const ix = await indexSnapshot(false);
  await probeIndex(ix);
  assert(usableIndex(ix));
  for (const key of ["invalid", "management", "expired"] as const) {
    await checked(key);
    assert(!(await embeddingsAvailable()));
    assert(!usableIndex(await indexSnapshot(false)));
    const count: number = mock.requests;
    assert.equal((await search("key status")).search.mode, "exact");
    assert.equal(mock.requests, count);
  }
  await checked("valid");
  assert(await embeddingsAvailable());
}

async function sessionRegressions(mock: Mock) {
  for (const cleanup of ["sweep", "claim"]) {
    const expires = Date.now() + 1200,
      cap = searchTicket(expires);
    const before = mock.requests;
    assert.equal((await search("session expiry", cap)).search.mode, "semantic");
    assert.equal((await search("session expiry", cap)).search.mode, "semantic");
    if (cleanup === "sweep") {
      await db
        .updateTable("search_session")
        .set({ status: "pending" })
        .where(
          "capabilityHash",
          "=",
          createHash("sha256").update(cap).digest("hex"),
        )
        .execute();
      assert.equal(
        (await search("session expiry", cap)).search.status,
        "pending",
      );
    }
    await delay(Math.max(0, expires - Date.now()) + 10);
    await assert.rejects(search("session expiry", cap), {
      message: "SEARCH_RESTART_REQUIRED",
    });
    if (cleanup === "sweep") await sweep(false);
    else await search("separate request");
    const expected = before + (cleanup === "sweep" ? 1 : 2);
    await assert.rejects(search("session expiry", cap), {
      message: "SEARCH_RESTART_REQUIRED",
    });
    assert.equal(mock.requests, expected);
    assert.equal((await search("session expiry")).search.mode, "semantic");
    assert.equal(mock.requests, expected + 1);
  }
  await assert.rejects(
    searchPage({ ...board, text: "missing ticket", limit: 20 }),
    { message: "SEARCH_RESTART_REQUIRED" },
  );
  // Snapshot projections must remain bounded even at the session cap.
  await seed(1000);
  const ticket = searchTicket(),
    result = await search("Review", ticket),
    hash = createHash("sha256").update(ticket).digest("hex");
  assert.equal(result.search.total, 1000);
  for (const [ordinal, expected] of [
    [0, 20],
    [500, 20],
    [995, 5],
    [1000, 0],
  ]) {
    const projection = await readStoredPage(db, hash, "{}", ordinal, 20);
    assert(projection);
    assert.equal(projection.entries.length, expected);
    assert.equal(projection.total, 1000);
    assert(!("queryVector" in projection || "results" in projection));
    assert(Buffer.byteLength(JSON.stringify(projection)) < 3000);
  }
  await assert.rejects(
    searchPage({
      ...board,
      text: "Review",
      limit: 20,
      cursor: { capability: ticket, nextOrdinal: 1001 },
    }),
    { message: "SEARCH_RESTART_REQUIRED" },
  );
  await clearContent();
  const observer = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: "review-observer",
  });
  const lock = await observer.connect();
  try {
    await lock.query("begin");
    await lock.query("lock table feedback in access exclusive mode");
    const stop = new AbortController(),
      busy = searchPage({
        ...board,
        text: "cancel",
        limit: 20,
        capability: searchTicket(),
        signal: stop.signal,
      });
    const outcome = busy.then(
      () => undefined,
      (error: Error) => error.message,
    );
    await eventually(
      async () =>
        (
          await observer.query(
            "select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='feedbackland-app' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0) as waiting",
          )
        ).rows[0].waiting,
      Boolean,
      4000,
    );
    stop.abort();
    await Promise.race([
      Promise.all([
        outcome.then((message) => assert.equal(message, "REQUEST_CANCELLED")),
        getPool().query("select 1"),
      ]),
      delay(2000).then(() => {
        throw Error("Cancelled search retained its connection");
      }),
    ]);
  } finally {
    await lock.query("rollback");
    lock.release();
    await observer.end();
  }
}

async function cancellationAtAcquisitionAndPublication(mock: Mock) {
  const scope = { ...board, text: "Cancellation boundary", limit: 20 };
  const rejected = (promise: Promise<unknown>) =>
    assert.rejects(promise, { message: "REQUEST_CANCELLED" });
  const slot = await getPool().connect();
  try {
    const stop = new AbortController();
    const outcome = rejected(
      searchPage({ ...scope, capability: searchTicket(), signal: stop.signal }),
    );
    await eventually(
      async () => getPool().waitingCount,
      (n) => n > 0,
      2000,
    );
    stop.abort();
    await Promise.race([
      outcome,
      delay(1500).then(() => {
        throw Error("Cancelled search waited for pool acquisition");
      }),
    ]);
  } finally {
    slot.release();
  }
  const observer = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: "search-publication-observer",
  });
  const lock = await observer.connect();
  const normal = mock.handler,
    entered = Promise.withResolvers<void>(),
    resume = Promise.withResolvers<void>();
  const stop = new AbortController();
  mock.handler = async (wire) => {
    if (wire.url === "/api/v1/embeddings") {
      entered.resolve();
      await resume.promise;
    }
    return normal(wire);
  };
  const ticket = searchTicket();
  const hash = createHash("sha256").update(ticket).digest("hex");
  try {
    const outcome = rejected(
      searchPage({ ...scope, capability: ticket, signal: stop.signal }),
    );
    await Promise.race([
      entered.promise,
      delay(4000).then(() => {
        throw Error("Search never reached query embedding");
      }),
    ]);
    await lock.query("begin");
    const row = await lock.query(
      'select status from search_session where "capabilityHash"=$1 for update',
      [hash],
    );
    assert.equal(row.rows[0].status, "pending");
    resume.resolve();
    await eventually(
      async () =>
        (
          await observer.query(
            "select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='feedbackland-app' and query ilike 'update%search_session%' and cardinality(pg_blocking_pids(pid))>0) waiting",
          )
        ).rows[0].waiting,
      Boolean,
      4000,
    );
    stop.abort();
    await Promise.race([
      Promise.all([outcome, getPool().query("select 1")]),
      delay(2000).then(() => {
        throw Error("Cancelled publication retained its connection");
      }),
    ]);
    assert.equal(
      (
        await lock.query(
          'select status from search_session where "capabilityHash"=$1',
          [hash],
        )
      ).rows[0].status,
      "pending",
    );
  } finally {
    resume.resolve();
    stop.abort();
    mock.handler = normal;
    await lock.query("rollback");
    lock.release();
    await observer.end();
  }
}

async function indexingRegressions(mock: Mock) {
  await db
    .deleteFrom("rate_limit")
    .where("key", "=", "ai-check:user:" + admin.userId)
    .execute();
  const normal = mock.handler;
  const recorded: string[][] = [];
  let refused: string | undefined,
    outage = false,
    contextFault = false,
    rejectOnce = false,
    failSecond = false;
  mock.handler = (wire) => {
    if (wire.url === "/api/v1/embeddings") {
      const inputs = wire.body.input as string[];
      recorded.push(inputs);
      if (outage || (failSecond && inputs.length === 11))
        return json(wire.response, {}, 503);
      if (rejectOnce && inputs.some((input) => input.includes("Content 1"))) {
        rejectOnce = false;
        return json(wire.response, {}, 400);
      }
      if (contextFault && inputs.includes("profile check"))
        return json(
          wire.response,
          { error: { metadata: { error_type: "context_length_exceeded" } } },
          400,
        );
      if (
        refused &&
        (refused === "all" || inputs.some((t) => t.includes(refused!)))
      )
        return json(wire.response, {}, 400);
    }
    return normal(wire);
  };
  let ix = await indexSnapshot(false);
  // A previously verified service must cool down during ordinary request failures.
  outage = true;
  const before = recorded.length;
  for (let i = 0; i < 2; i++)
    assert.equal((await search("outage")).search.mode, "exact");
  assert.equal(recorded.length, before + 1);
  assert.equal(probeInfo(ix)?.reason, "unverified");
  assert(!(await embeddingsAvailable()));
  outage = false;
  await checked("valid");
  ix = await indexSnapshot(false);
  await probeIndex(ix);
  assert(usableIndex(ix));
  contextFault = true;
  await search("profile check");
  contextFault = false;
  const spent = recorded.length;
  for (let i = 0; i < 2; i++) await probeIndex(ix);
  assert.equal(recorded.length, spent);
  assert.equal(probeInfo(ix)?.reason, "profile-context-length");
  await rebuildIndex(admin, {
    token: ix.config.token,
    epoch: ix.epoch,
    dimensions: 768,
  });
  const budget = async (limit: number) => {
    await resetBudget();
    await saveConfiguration(admin, await configuration(), {
      options: { dailyCallLimit: limit },
    });
    const index = await indexSnapshot(true);
    await probeIndex(index);
    assert(usableIndex(index));
    return index;
  };
  ix = await budget(10);
  const owner = await acquireLease("ai-maintenance");
  assert(owner);
  try {
    for (const failure of ["budget", "provider"]) {
      await clearContent();
      await seed(64);
      await resetBudget();
      if (failure === "budget") {
        await search("seed daily counter");
        await db
          .updateTable("rate_limit")
          .set({ count: 7 })
          .where("key", "like", "ai:instance:day:%")
          .execute();
      } else {
        ix = await budget(5000);
        failSecond = true;
      }
      const start = recorded.length;
      await assert.rejects(backfillBatch(ix, owner.lease, owner.signal), {
        reason: failure === "budget" ? "AI_PAUSED" : "provider-error",
      });
      assert.equal(await indexed(), 53);
      assert.equal(recorded[start].length, 53);
      const succeeded = new Set(recorded[start]);
      failSecond = false;
      await resetBudget();
      await checked("valid");
      ix = await indexSnapshot(false);
      await probeIndex(ix);
      const resume = recorded.length;
      assert.equal(await backfillBatch(ix, owner.lease, owner.signal), 11);
      assert.equal(recorded[resume].length, 11);
      assert(recorded[resume].every((t) => !succeeded.has(t)));
    }
    await clearContent();
    await seed(1);
    refused = "all";
    await assert.rejects(backfillBatch(ix, owner.lease, owner.signal), {
      reason: "provider-input",
    });
    assert.equal(
      (
        await db
          .selectFrom("feedback")
          .select("embeddingSkipped")
          .executeTakeFirstOrThrow()
      ).embeddingSkipped,
      false,
    );
    refused = undefined;
    rejectOnce = true;
    assert.equal(await backfillBatch(ix, owner.lease, owner.signal), 1);
    await seed(3);
    refused = "Content 2";
    await backfillBatch(ix, owner.lease, owner.signal);
    assert.deepEqual(
      (
        await db
          .selectFrom("feedback")
          .select("plainText")
          .where("embeddingSkipped", "=", true)
          .execute()
      ).map((r) => r.plainText),
      ["Content 2"],
    );
  } finally {
    await owner.release();
    mock.handler = normal;
    await clearContent();
  }
}

async function qualityAndRepair() {
  const ix = await indexSnapshot(false);
  assert(ix.physical);
  const basis = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
  await sql`insert into feedback(title,description,"plainText","moderationState",embedding) values
    ('Endpoint','body','body','screened',${JSON.stringify(basis)}::vector),
    ('Orthogonal','body','body','screened',${JSON.stringify(basis.map((_, i) => (i === 1 ? 1 : 0)))}::vector),
    ('Opposite','body','body','screened',${JSON.stringify(basis.map((x) => -x))}::vector)`.execute(
    db,
  );
  const phrase = "Café",
    decomposed = phrase.normalize("NFD");
  const post = await db
    .insertInto("feedback")
    .values({
      title: decomposed,
      description: "body",
      plainText: "body",
      moderationState: "screened",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("comment")
    .values({
      postId: post.id,
      content: decomposed,
      plainText: decomposed,
      moderationState: "screened",
    })
    .execute();
  await db
    .insertInto("feedback")
    .values({
      title: "plain",
      description: decomposed,
      plainText: decomposed,
      moderationState: "screened",
    })
    .execute();
  await db.transaction().execute(async (trx) => {
    const semantic = { vector: basis, physical: ix.physical!, maxDistance: 0 };
    const zero = await materialize(trx, board, "Endpoint", semantic);
    assert.deepEqual(
      zero.results.map((x) => x[2]),
      [0],
    );
    const two = await materialize(trx, board, "No lexical match", {
      ...semantic,
      maxDistance: 2,
    });
    assert.deepEqual(
      two.results.map((x) => x[2]),
      [0, 1, 2],
    );
    const scope: SearchScope = {
      ...board,
      surface: "activity",
      userId: admin.userId,
    };
    for (const ranking of [undefined, semantic]) {
      const results = await materialize(trx, scope, phrase, ranking);
      assert.deepEqual(
        results.results
          .filter((x) => x[2] === null)
          .map((x) => x[0])
          .sort(),
        ["comment", "post", "post"],
      );
    }
    for (const n of [1e-30, 1e30]) {
      const vector = [n, 0, 0];
      assert(!validCosineVector(vector, 3));
      assert.equal(
        (
          await sql<{
            d: string;
          }>`select (${JSON.stringify(vector)}::vector <=> ${JSON.stringify(vector)}::vector)::text d`.execute(
            trx,
          )
        ).rows[0].d,
        "NaN",
      );
    }
    for (const [kind, size] of [
      ["vector", 768],
      ["halfvec", 3072],
    ] as const) {
      const vector = Array(size).fill(0.125);
      assert(validCosineVector(vector, size));
      const type = sql.id(kind);
      const value = JSON.stringify(vector);
      assert.equal(
        (
          await sql<{
            d: number;
          }>`select ${value}::${type} <=> ${value}::${type} d`.execute(trx)
        ).rows[0].d,
        0,
      );
    }
  });
  await sql`drop index feedback_embedding_idx`.execute(db);
  let current = await indexSnapshot(false);
  assert.equal(current.reason, "rebuild-required");
  await sql`create index feedback_embedding_idx on feedback using hnsw (embedding vector_l2_ops)`.execute(
    db,
  );
  current = await indexSnapshot(false);
  assert.equal(current.reason, "rebuild-required");
  await rebuildIndex(admin, {
    token: current.config.token,
    epoch: current.epoch,
    dimensions: 768,
  });
  assert((await physicalVector(db))?.indexesValid);
  await sql`alter table comment alter column embedding type vector(4) using null`.execute(
    db,
  );
  current = await indexSnapshot(false);
  assert.equal(current.reason, "column-mismatch");
  await rebuildIndex(admin, {
    token: current.config.token,
    epoch: current.epoch,
    dimensions: 768,
  });
  assert((await physicalVector(db))?.indexesValid);
  await db.transaction().execute(async (trx) => {
    await sql`set local enable_seqscan=off`.execute(trx);
    for (const table of ["feedback", "comment"]) {
      const plan =
        await sql`explain (format json) select id from ${sql.table(table)} order by embedding <=> ${JSON.stringify(basis)} limit 10`.execute(
          trx,
        );
      assert(JSON.stringify(plan.rows).includes(table + "_embedding_idx"));
    }
  });
  await clearContent();
}

async function diagnosticAndWriteRegressions(mock: Mock) {
  const ix = await indexSnapshot(false);
  await probeIndex(ix);
  assert(usableIndex(ix));
  const owner = await acquireLease("ai-maintenance");
  assert(owner);
  const normal = mock.handler,
    paths: string[] = [];
  let failedPath = "",
    management = false;
  mock.handler = (wire) => {
    paths.push(wire.url);
    if (management && wire.url === "/api/v1/key")
      return json(wire.response, {
        data: {
          is_management_key: true,
          is_free_tier: false,
          usage: 0,
          limit: 100,
          limit_remaining: 100,
          expires_at: null,
        },
      });
    if (wire.url === failedPath) return json(wire.response, {}, 503);
    return normal(wire);
  };
  try {
    for (const cap of ["chat", "embeddings"]) {
      await sql`insert into ai_health("configToken",capability,"failingSince","lastFailureAt","lastReason")
        values(${ix.config.token},${cap},clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day','provider-error')
        on conflict("configToken",capability) do update set "failingSince"=excluded."failingSince","lastFailureAt"=excluded."lastFailureAt","lastReason"=excluded."lastReason"`.execute(
        db,
      );
    }
    assert.deepEqual(await unhealthyCapabilities(ix.config, owner.signal), []);
    await maintenanceDiagnostics(ix, owner);
    assert.deepEqual(paths, []);
    await sql`update ai_health set "lastFailureAt"=clock_timestamp() where "configToken"=${ix.config.token}`.execute(
      db,
    );
    failedPath = "/api/v1/embeddings";
    await maintenanceDiagnostics(ix, owner);
    assert.deepEqual(paths.sort(), [
      "/api/v1/chat/completions",
      "/api/v1/embeddings",
      "/api/v1/key",
    ]);
    const check = (await configuration()).check;
    assert.equal(check?.key, "valid");
    assert.equal(check?.chat, "passed");
    assert.equal(check?.search, "failed");
    assert.equal(
      (await unhealthyCapabilities(ix.config, owner.signal)).length,
      2,
    );
    paths.length = 0;
    failedPath = "/api/v1/chat/completions";
    await maintenanceDiagnostics(ix, owner);
    const sibling = (await configuration()).check;
    assert.equal(sibling?.chat, "failed");
    assert.equal(sibling?.search, "passed");
    assert.equal(paths.filter((path) => path === "/api/v1/key").length, 1);
    paths.length = 0;
    management = true;
    await maintenanceDiagnostics(ix, owner);
    assert.deepEqual(paths, ["/api/v1/key"]);
    assert.equal((await configuration()).check?.key, "management");
    management = false;
    await checked("valid");
    await sql`update ai_health set "failingSince"=null where "configToken"=${ix.config.token}`.execute(
      db,
    );
  } finally {
    await owner.release();
    mock.handler = normal;
  }
  const held = Promise.withResolvers<void>(),
    resume = Promise.withResolvers<void>();
  mock.handler = async (wire) => {
    if (wire.url === "/api/v1/embeddings") {
      held.resolve();
      await resume.promise;
    }
    return normal(wire);
  };
  try {
    const committed = createFeedbackPostQuery({
      authorId: admin.userId,
      sessionId: admin.sessionId,
      description: "Immediate acknowledgement",
    });
    await held.promise;
    const post = await Promise.race([
      committed,
      delay(1000).then(() => {
        throw Error("Write acknowledgement waited for optional indexing");
      }),
    ]);
    assert.equal(
      (
        await db
          .selectFrom("feedback")
          .select("embedding")
          .where("id", "=", post.id)
          .executeTakeFirstOrThrow()
      ).embedding,
      null,
    );
    const edited = await Promise.race([
      updateFeedbackPostQuery({
        ...admin,
        postId: post.id,
        title: "Editing while indexing",
        description: "Current revision",
        expectedRevision: post.revision,
      }),
      delay(1500).then(() => {
        throw Error("Edit acknowledgement waited for optional indexing");
      }),
    ]);
    assert.equal(edited.revision, "2");
    resume.resolve();
    await Promise.all(runtimeState().activeEmbeddingWrites ?? []);
    assert(
      (
        await db
          .selectFrom("feedback")
          .select("embedding")
          .where("id", "=", post.id)
          .executeTakeFirstOrThrow()
      ).embedding,
    );
  } finally {
    resume.resolve();
    mock.handler = normal;
    await clearContent();
  }
}
async function main() {
  const boot = await migrateAndSeed();
  runtimeState().authSecret = boot.authSecret;
  const mock = await mockOpenRouter();
  try {
    await admissionAndIdentity(mock);
    await sessionRegressions(mock);
    await cancellationAtAcquisitionAndPublication(mock);
    await indexingRegressions(mock);
    await qualityAndRepair();
    await diagnosticAndWriteRegressions(mock);
    await maintenanceRegressions(mock);
    console.log("Search regressions passed");
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
