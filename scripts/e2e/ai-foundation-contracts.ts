import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { sql } from "kysely";
import { db } from "../../db/db";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { sealSecret, openSecret } from "../../lib/secret-box";
import {
  callChat,
  callEmbeddings,
  readProviderMetadata,
} from "../../lib/llm/client";
import { AiError, type Reason } from "../../lib/llm/errors";
import { defaults } from "../../lib/llm/defaults";
import {
  prepareChat,
  planVision,
  utf8Prefix,
  type VisionAsset,
} from "../../lib/llm/input-budgets";
import { embeddingBatch, prepareEmbedding } from "../../lib/llm/model-profiles";
import {
  configuration,
  beginCheck,
  saveCheck,
  saveConfiguration,
  beginCreditWait,
  completeCreditWait,
  synchronizeAiEnvironment,
  failingCapability,
} from "../../lib/llm/settings-store";
import {
  beginAttempt,
  admitMetadata,
  reserveInsightPlan,
} from "../../lib/llm/usage";
import { consumeAiBudget } from "../../queries/check-rate-limit";
import {
  chat,
  json,
  mockOpenRouter,
  privateMarker,
  firstKey,
  secondKey,
} from "../mock-llm";
import { eventually } from "./run";
import { contentContracts } from "./content-ai-contracts";
import { accountingRegressions } from "./ai-accounting-regressions";
import { transportRegressions } from "./ai-transport-regressions";
import { configurationRegressions } from "./ai-configuration-regressions";
import type { Actor } from "../../lib/auth/authorization";

type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
const passed = { key: "valid", chat: "passed", search: "passed" } as const;
const prompt = {
  system: "Answer from the provided board.",
  text: "Example question",
};
const moderationPrompt = {
  system: "Moderate fixture content.",
  text: "A suggestion",
};
const account = { userId: "fixture-admin", sessionId: "fixture-session" };
async function actor(userId: string, sessionId: string) {
  await db
    .insertInto("user")
    .values({
      id: userId,
      name: "Fixture admin",
      email: userId + "@example.invalid",
      emailVerified: true,
      role: "admin",
    })
    .execute();
  await db
    .insertInto("auth_session")
    .values({
      id: sessionId,
      token: sessionId,
      userId,
      scope: "first-party",
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
    })
    .execute();
  return { userId, sessionId };
}
async function denied(promise: Promise<unknown>, reason: Reason) {
  await assert.rejects(
    promise,
    (error) =>
      error instanceof AiError &&
      error.reason === reason &&
      error.cause === undefined &&
      !JSON.stringify(error).includes("P07_PRIVATE_") &&
      !error.stack?.includes("P07_PRIVATE_"),
    "Expected a mapped " + reason + " failure",
  );
}
async function usage(feature: string) {
  return db
    .selectFrom("llm_usage")
    .selectAll()
    .where("feature", "=", feature)
    .executeTakeFirstOrThrow();
}
async function health(configToken: string, capability: "chat" | "embeddings") {
  return db
    .selectFrom("ai_health")
    .selectAll()
    .where("configToken", "=", configToken)
    .where("capability", "=", capability)
    .executeTakeFirstOrThrow();
}
async function resetCounters() {
  await db
    .deleteFrom("rate_limit")
    .where((eb) =>
      eb.or([eb("key", "like", "ai:%"), eb("key", "like", "ai-check:%")]),
    )
    .execute();
}

async function identityChecks(mock: Mock) {
  const initial = await configuration();
  assert.equal(initial.configured, false);
  await denied(callChat("title", prompt), "AI_NOT_CONFIGURED");
  await denied(callEmbeddings("probe", ["index"]), "AI_NOT_CONFIGURED");
  assert.equal(mock.requests, 0);
  const sealed = sealSecret(firstKey, "fixture-secret", "column");
  assert(sealed !== sealSecret(firstKey, "fixture-secret", "column"));
  assert(openSecret(sealed, "fixture-secret", "column") === firstKey);
  assert.equal(openSecret(sealed, "fixture-secret", "another"), null);
  assert.equal(openSecret(sealed, "rotated", "column"), null);
  assert.equal(openSecret(sealed + ".", "fixture-secret", "column"), null);
  await actor(account.userId, account.sessionId);
  await assert.rejects(
    saveConfiguration({ userId: account.userId }, initial, {
      apiKey: firstKey,
    }),
  );
  const attempts = await Promise.allSettled(
    [1, 2].map(() => saveConfiguration(account, initial, { apiKey: firstKey })),
  );
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  assert(
    attempts.some(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof AiError &&
        r.reason.reason === "STALE_CONFIGURATION",
    ),
  );
  const pending = await configuration();
  assert.equal(BigInt(pending.revision), BigInt(initial.revision) + 1n);
  assert.match(pending.token, /^[a-f0-9]{64}$/);
  assert.equal(pending.configured, false);
  await denied(callChat("rewrite", prompt), "AI_NOT_CONFIGURED");
  assert.equal(mock.requests, 0);
  await denied(callEmbeddings("probe", ["width"]), "AI_NOT_CONFIGURED");
  const pendingCheck = await beginCheck(pending, {
    actor: account,
    intent: "configure",
  });
  const dbKey = await db
    .selectFrom("ai_settings")
    .select(["apiKey", "apiKeyLast4", "apiKeySetAt"])
    .executeTakeFirstOrThrow();
  assert(dbKey.apiKey?.startsWith("v1.") && !dbKey.apiKey.includes(firstKey));
  assert.equal(dbKey.apiKeyLast4, "1111");
  const wait = await beginCreditWait(pendingCheck);
  assert(wait && dbKey.apiKeySetAt);
  assert.equal(wait.getTime() - dbKey.apiKeySetAt.getTime(), 7 * 86400000);
  assert.equal(await saveCheck(pendingCheck, passed), true);
  await saveConfiguration(account, pending, { apiKey: secondKey });
  const second = await configuration();
  assert.notEqual(second.keyDigest, pending.keyDigest);
  assert.notEqual(second.token, pending.token);
  assert.equal(second.check, null);
  assert.equal(await saveCheck(pendingCheck, passed), false);
  assert.equal(
    await completeCreditWait(pendingCheck, pending.keyDigest!, wait, passed),
    null,
  );
  mock.expectedKey = secondKey;
  const secondCheck = await beginCheck(second, {
    actor: account,
    intent: "configure",
  });
  const secondWait = await beginCreditWait(secondCheck);
  assert(secondWait);
  assert.equal(
    await completeCreditWait(
      secondCheck,
      pending.keyDigest!,
      secondWait,
      passed,
    ),
    null,
  );
  const on = await completeCreditWait(
    secondCheck,
    second.keyDigest!,
    secondWait,
    passed,
  );
  assert(on);
  assert.equal((await configuration()).check?.configToken, on.token);
  await saveConfiguration(account, on, { enabled: false });
  const off = await configuration();
  await denied(callChat("check", prompt), "AI_NOT_CONFIGURED");
  await denied(callEmbeddings("probe", ["x"]), "AI_NOT_CONFIGURED");
  assert.equal(
    await completeCreditWait(
      secondCheck,
      second.keyDigest!,
      secondWait,
      passed,
    ),
    null,
  );
  const offCheck = await beginCheck(off, {
    actor: account,
    intent: "configure",
  });
  await callChat("check", prompt, { check: offCheck });
  await saveCheck(offCheck, passed);
  await saveConfiguration(account, off, { enabled: true });
  const active = await configuration();
  assert(active.configured && active.check?.search === "passed");
  const secret = runtimeState().authSecret!;
  process.env.OPENROUTER_API_KEY = firstKey;
  delete runtimeState().aiConfig;
  assert.equal(
    await db
      .transaction()
      .execute((trx) => synchronizeAiEnvironment(trx, secret)),
    false,
  );
  await denied(callChat("title", prompt), "CONFIGURATION_DIVERGED");
  await db
    .deleteFrom("job_lease")
    .where("name", "like", "ai-config:%")
    .execute();
  assert.equal(
    await db
      .transaction()
      .execute((trx) => synchronizeAiEnvironment(trx, secret)),
    true,
  );
  delete runtimeState().aiConfig;
  const fromEnv = await configuration();
  assert(fromEnv.configured && fromEnv.apiKey === firstKey);
  await denied(
    saveConfiguration(account, fromEnv, { apiKey: secondKey }),
    "invalid-input",
  );
  delete process.env.OPENROUTER_API_KEY;
  await db
    .transaction()
    .execute((trx) => synchronizeAiEnvironment(trx, secret));
  delete runtimeState().aiConfig;
  runtimeState().authSecret = "rotated-for-fixture";
  delete runtimeState().aiConfig;
  await denied(callChat("title", prompt), "key-unreadable");
  await denied(callChat("title", prompt), "key-unreadable");
  runtimeState().authSecret = secret;
  delete runtimeState().aiConfig;
  process.env.AI_EMBEDDING_DIMENSIONS = "4";
  await db
    .transaction()
    .execute((trx) => synchronizeAiEnvironment(trx, secret));
  delete runtimeState().aiConfig;
  const mismatch = await configuration();
  assert(mismatch.widthMismatch && mismatch.dimensions === 3);
  await denied(callEmbeddings("probe", ["width"]), "AI_UNAVAILABLE");
  process.env.AI_EMBEDDING_DIMENSIONS = "3";
  await db
    .transaction()
    .execute((trx) => synchronizeAiEnvironment(trx, secret));
  delete runtimeState().aiConfig;
}
function inputChecks() {
  assert.equal(utf8Prefix("x💬z", 4), "x");
  assert.equal(utf8Prefix("x💬z", 5), "x💬");
  assert.throws(
    () => prepareChat("title", { ...prompt, text: "a".repeat(48000) }),
    AiError,
  );
  assert.throws(
    () =>
      prepareChat("ask-ai", {
        ...prompt,
        history: Array(9).fill({ role: "user", content: "a" }),
      }),
    AiError,
  );
  assert.throws(
    () =>
      prepareChat("ask-ai", {
        ...prompt,
        history: Array(5).fill({ role: "user", content: "é".repeat(2000) }),
      }),
    AiError,
  );
  assert.throws(
    () =>
      prepareChat("ask-ai", {
        ...prompt,
        history: [{ role: "system" as "user", content: "a" }],
      }),
    AiError,
  );
  assert.throws(
    () => prepareChat("title", { ...prompt, system: "a".repeat(8193) }),
    AiError,
  );
  const packed = prepareChat("insights", {
    ...prompt,
    items: Array(202).fill("💬".repeat(700)),
  });
  assert(
    Buffer.byteLength(packed.messages[0].content) +
      Buffer.byteLength(packed.system) <=
      64000 && packed.omitted > 2,
  );
  const model = defaults.embeddingModel,
    source = "龘 ".repeat(3000) + "<|endoftext|>😀";
  const p = prepareEmbedding(model, source)!;
  assert(
    p.tokens <= 8000 &&
      source.startsWith(p.text) &&
      p.text.length < source.length,
  );
  assert.equal(prepareEmbedding(model, p.text)!.tokens, p.tokens);
  assert.equal(
    embeddingBatch(model, ["  ", "<|endoftext|>"])[0].text,
    "<|endoftext|>",
  );
  assert.equal(
    [...embeddingBatch(model, ["😀".repeat(201)], true)[0].text].length,
    200,
  );
  assert.throws(() => embeddingBatch(model, Array(65).fill("x")), AiError);
  assert.throws(() => embeddingBatch(model, Array(5).fill(source)), AiError);
  assert.throws(
    () => embeddingBatch(model, Array(5).fill("abcdefgh ".repeat(3556))),
    AiError,
  );
  const started = performance.now();
  assert.equal(prepareEmbedding(model, "a".repeat(128000))?.tokens, 8000);
  assert(
    performance.now() - started < 5000,
    "Long pieces must fit the embedding preparation time budget",
  );
  assert.throws(() => embeddingBatch("unknown", ["x"]), AiError);
}

async function wireChecks(mock: Mock) {
  await resetCounters();
  const start = mock.requests;
  const titleBefore = await db
    .selectFrom("llm_usage")
    .select("calls")
    .where("feature", "=", "title")
    .executeTakeFirst();
  assert.equal((await callChat("title", prompt)).text, "fixture answer");
  assert.deepEqual(mock.last.body.provider, { data_collection: "deny" });
  assert.equal(mock.last.body.max_tokens, 1024);
  assert.deepEqual(mock.last.body.response_format, { type: "json_object" });
  const titled = await usage("title");
  assert.equal(titled.calls, (titleBefore?.calls ?? 0) + 1);
  assert.equal(titled.inputTokens, "9");
  assert.equal(Number(titled.costUsd), 0.001);
  await callChat("rewrite", prompt);
  assert.equal(mock.last.body.max_tokens, 2048);
  let str = "";
  const streamed = await callChat("ask-ai", prompt, {
    onText: (s) => {
      str += s;
    },
  });
  assert.equal(streamed.text, "hello board");
  assert.equal(str, streamed.text);
  assert.equal(mock.last.body.max_tokens, 4096);
  assert(!("feedbackland_cache" in mock.last.body));
  assert.deepEqual(
    (mock.last.body.messages as { content: unknown }[])[0].content,
    [
      {
        type: "text",
        text: prompt.system,
        cache_control: { type: "ephemeral" },
      },
    ],
  );
  assert.equal(Number((await usage("ask-ai")).costUsd), 0.042);
  await saveConfiguration(account, await configuration(), {
    options: { privacy: "zdr" },
  });
  const result = await callEmbeddings("embed-write", ["alpha", "beta"]);
  assert.deepEqual(result, [
    [1, 1, 1],
    [2, 2, 2],
  ]);
  assert.equal(mock.last.body.dimensions, 3);
  assert.deepEqual(mock.last.body.provider, {
    data_collection: "deny",
    zdr: true,
  });
  const embedUsage = await usage("embed-write");
  assert.equal(Number(embedUsage.costUsd), 0.0000021);
  assert.equal(embedUsage.inputTokens, "17");
  await saveConfiguration(account, await configuration(), {
    options: { privacy: "allow" },
  });
  await callEmbeddings("embed-query", ["alpha"]);
  assert.deepEqual(mock.last.body.provider, { data_collection: "allow" });
  await saveConfiguration(account, await configuration(), {
    options: { privacy: "deny" },
  });
  assert.equal(mock.requests, start + 5);
  const metaBefore = await db
    .selectFrom("llm_usage")
    .selectAll()
    .orderBy("feature")
    .execute();
  const info = await readProviderMetadata("key", account);
  assert("remaining" in info && info.remaining === 12.5);
  const models = await readProviderMetadata("chatModels", account);
  assert(
    Array.isArray(models) &&
      models[0].vision &&
      !JSON.stringify(models).includes(privateMarker),
  );
  await readProviderMetadata("embeddingModels", account);
  assert.equal(
    mock.last.url,
    "/api/v1/models/user?output_modalities=embeddings",
  );
  assert.deepEqual(
    await db.selectFrom("llm_usage").selectAll().orderBy("feature").execute(),
    metaBefore,
  );
}
async function responseChecks(mock: Mock) {
  const config = await configuration();
  const before = await usage("title");
  mock.handler = ({ response }) =>
    json(
      response,
      {
        error: { message: privateMarker, metadata: { private: privateMarker } },
        usage: { cost: 0.002, prompt_tokens: 4 },
      },
      503,
    );
  await denied(
    callChat("title", { ...prompt, text: privateMarker }),
    "provider-error",
  );
  const after = await usage("title");
  assert.equal(after.calls, before.calls + 1);
  assert.equal(after.errors, before.errors + 1);
  assert.equal(after.uncostedCalls, before.uncostedCalls);
  assert.equal(Number(after.costUsd) - Number(before.costUsd), 0.002);
  mock.handler = ({ response }) => chat(response, null);
  await callChat("title", prompt);
  assert.equal((await usage("title")).uncostedCalls, after.uncostedCalls + 1);
  mock.handler = ({ response }) => chat(response, 0);
  await callChat("title", prompt);
  assert.equal((await usage("title")).uncostedCalls, after.uncostedCalls + 1);
  mock.handler = ({ response }) =>
    json(response, {
      error: {
        code: 403,
        message: privateMarker,
        metadata: { error_type: "refusal" },
      },
    });
  const healthy = await health(config.token, "chat");
  await denied(callChat("moderation", moderationPrompt), "provider-refusal");
  assert.equal(
    (await health(config.token, "chat")).lastAppliedSequence,
    healthy.lastAppliedSequence,
  );
  mock.handler = ({ response }) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{" + privateMarker);
  };
  await denied(callChat("title", prompt), "invalid-response");
  mock.handler = ({ response }) => {
    response.writeHead(307, {
      location: "https://openrouter.ai/api/v1/unexpected",
    });
    response.end();
  };
  await denied(callChat("title", prompt), "provider-error");
  mock.handler = ({ response }) => {
    response.writeHead(200);
    response.write(Buffer.alloc(600000));
    response.end(Buffer.alloc(600000));
  };
  await denied(callChat("title", prompt), "response-too-large");
  mock.handler = ({ response }) => {
    response.writeHead(200, { "content-length": 5 * 1024 * 1024 });
    response.end();
  };
  await denied(readProviderMetadata("key", account), "response-too-large");
  mock.handler = ({ response }) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      "data: " +
        JSON.stringify({ error: { message: privateMarker } }) +
        "\n\ndata: [DONE]\n\n",
    );
  };
  await denied(
    callChat("ask-ai", prompt, { onText: () => {} }),
    "provider-error",
  );
  mock.handler = ({ response }) => chat(response, 0, "content_filter");
  await denied(callChat("moderation", moderationPrompt), "provider-refusal");
  mock.handler = ({ response }) =>
    json(response, {
      data: [{ index: 0, embedding: [0, 1] }],
      usage: { cost: 0 },
    });
  await denied(callEmbeddings("embed-query", ["x"]), "invalid-response");
  mock.handler = ({ response }) =>
    json(response, {
      data: [
        { index: 0, embedding: [1, 1, 1] },
        { index: 0, embedding: [2, 2, 2] },
      ],
    });
  await denied(callEmbeddings("embed-write", ["x", "y"]), "invalid-response");
  mock.handler = ({ response }) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(":");
    response.end("x".repeat(1024 * 1024));
  };
  await denied(
    callChat("ask-ai", prompt, { onText: () => {} }),
    "response-too-large",
  );
  for (const amount of [1e-13, "unknown"]) {
    const base = await usage("title");
    mock.handler = ({ response }) => chat(response, amount);
    await callChat("title", prompt);
    assert.equal((await usage("title")).uncostedCalls, base.uncostedCalls + 1);
  }
  const checks = await usage("check");
  const previous = await health(config.token, "chat");
  let count = 0;
  mock.handler = ({ response }) => {
    if (++count === 1)
      json(
        response,
        {
          error: {
            message:
              "No endpoints found matching your data policy. " + privateMarker,
          },
        },
        404,
      );
    else chat(response);
  };
  await callChat("check", prompt);
  assert.equal(count, 2);
  assert.equal((await usage("check")).calls, checks.calls + 2);
  mock.handler = ({ response }) => {
    response.setHeader("Retry-After", "0");
    json(
      response,
      { error: { metadata: { limit_source: "openrouter_in_flight_budget" } } },
      402,
    );
  };
  const start = mock.requests;
  await denied(callChat("check", prompt), "in-flight-budget");
  assert.equal(mock.requests, start + 2);
  assert.equal(
    (await health(config.token, "chat")).nextSequence,
    previous.nextSequence,
  );
  mock.reset();
}

async function concurrencyChecks(mock: Mock) {
  await saveConfiguration(account, await configuration(), {
    options: { timeoutMs: 15000 },
  });
  const active = await configuration();
  let release: () => void = () => {};
  const hold = new Promise<void>((r) => {
    release = r;
  });
  mock.handler = async ({ response }) => {
    await hold;
    json(response, { error: { message: privateMarker } }, 503);
  };
  const older = denied(callChat("title", prompt), "provider-error");
  await eventually(
    async () => mock.active,
    (n) => n === 1,
  );
  mock.reset();
  await Promise.all([
    callChat("title", prompt),
    callEmbeddings("embed-query", ["x"]),
  ]);
  release();
  await older;
  assert.equal((await health(active.token, "chat")).lastReason, null);
  assert.equal((await health(active.token, "embeddings")).lastReason, null);
  // Hold another request across a key/configuration change. Its spend stays on
  // its original day but its health result cannot modify either generation.
  let unlock: () => void = () => {};
  const delayed = new Promise<void>((r) => {
    unlock = r;
  });
  mock.handler = async ({ response }) => {
    await delayed;
    json(response, {}, 503);
  };
  const stale = denied(callChat("title", prompt), "provider-error");
  await eventually(
    async () => mock.active,
    (n) => n === 1,
  );
  await saveConfiguration(account, active, { options: { privacy: "zdr" } });
  const latest = await configuration();
  mock.reset();
  await callChat("title", prompt);
  unlock();
  await stale;
  assert.equal((await health(latest.token, "chat")).lastReason, null);
  assert.equal((await health(active.token, "chat")).lastReason, null);
  await db
    .updateTable("ai_health")
    .where("configToken", "=", latest.token)
    .where("capability", "=", "chat")
    .set({
      failingSince: sql`now()-interval '16 minutes'`,
      lastFailureAt: sql`now()`,
    })
    .execute();
  assert.equal(await failingCapability(latest, "chat"), true);
  await denied(callChat("rewrite", prompt), "AI_UNAVAILABLE");
  await db
    .updateTable("ai_health")
    .where("configToken", "=", latest.token)
    .set({ lastFailureAt: sql`now()-interval '11 minutes'` })
    .execute();
  assert.equal(await failingCapability(latest, "chat"), false);
  await resetCounters();
  let loads = 0;
  const assets: VisionAsset[] = Array.from({ length: 4 }, (_, i) => ({
    id: "image-" + i,
    width: 2000,
    height: 2000,
    byteSize: 1000000,
    contentType: "image/png",
    load: async (signal) => {
      signal.throwIfAborted();
      loads++;
      return Buffer.alloc(1000000, 42);
    },
  }));
  assert.throws(
    () => planVision([{ ...assets[0], byteSize: 1000001 }]),
    AiError,
  );
  assert.throws(
    () => planVision([{ ...assets[0], contentType: "image/gif" }]),
    AiError,
  );
  mock.handler = ({ response }) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.flushHeaders();
  };
  const cancel = new AbortController();
  const options = { signal: cancel.signal };
  const vision = denied(
    callChat("moderation", moderationPrompt, {
      ...options,
      images: [...assets, assets[0]],
    }),
    "aborted",
  );
  await eventually(
    async () => mock.active,
    (n) => n === 1,
  );
  const loadCount = loads;
  const burst = await Promise.all(
    Array.from({ length: 32 }, () =>
      denied(
        callChat("moderation", moderationPrompt, { images: assets }),
        "VISION_BUSY",
      ),
    ),
  );
  assert.equal(burst.length, 32);
  assert.equal(loadCount, 4);
  assert.equal(loads, loadCount);
  const model = Array.from({ length: 8 }, () =>
    denied(callChat("title", prompt, options), "aborted"),
  );
  const meta = Array.from({ length: 2 }, () =>
    denied(readProviderMetadata("key", account, cancel.signal), "aborted"),
  );
  try {
    await eventually(
      async () => mock.active,
      (n) => n === 11,
    );
    await denied(callEmbeddings("embed-query", ["x"]), "AI_BUSY");
    await denied(readProviderMetadata("key", account), "AI_BUSY");
    assert.equal(
      (
        await db
          .selectFrom("ai_settings")
          .select("id")
          .executeTakeFirstOrThrow()
      ).id,
      1,
    );
  } finally {
    cancel.abort();
    await Promise.all([vision, ...model, ...meta]);
    mock.reset();
  }
  await eventually(
    async () => mock.active,
    (n) => n === 0,
  );
  assert.deepEqual(runtimeState().aiWork, { model: 0, vision: 0, metadata: 0 });
  await saveConfiguration(account, await configuration(), {
    options: { timeoutMs: 1000 },
  });
  mock.handler = ({ response }) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(": keepalive\n\n");
  };
  await denied(callChat("ask-ai", prompt, { onText: () => {} }), "timeout");
  mock.reset();
  await callChat("moderation", moderationPrompt, {
    images: [
      { ...assets[0], byteSize: 3, load: async () => Buffer.from([1, 2, 3]) },
    ],
  });
  assert.deepEqual(runtimeState().aiWork, { model: 0, vision: 0, metadata: 0 });
  await saveConfiguration(account, await configuration(), {
    options: { timeoutMs: 15000 },
  });
}

async function budgetChecks(mock: Mock) {
  await resetCounters();
  await saveConfiguration(account, await configuration(), {
    options: { dailyCallLimit: 10 },
  });
  const current = await configuration(),
    start = mock.requests;
  assert.equal(await consumeAiBudget(8, 9), null);
  const parallel = await Promise.all(
    Array.from({ length: 10 }, () => consumeAiBudget(8)),
  );
  const day = parallel.find(Boolean)!;
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(parallel.filter(Boolean).length, 8);
  await denied(callChat("title", prompt), "AI_PAUSED");
  await denied(callChat("check", prompt), "AI_PAUSED");
  await denied(callEmbeddings("probe", ["x"]), "AI_PAUSED");
  await denied(
    callChat("check", prompt, {
      check: await beginCheck(current, { actor: account, intent: "configure" }),
    }),
    "AI_PAUSED",
  );
  assert.equal(mock.requests, start);
  await callChat("moderation", moderationPrompt);
  await callChat("moderation", moderationPrompt);
  await denied(callChat("moderation", moderationPrompt), "AI_PAUSED");
  assert(await consumeAiBudget(40, 39, db, true));
  const check = await beginCheck(current, {
    actor: account,
    intent: "test-again",
  });
  await callChat("check", prompt, { check });
  await denied(callChat("check", prompt, { check }), "AI_PAUSED");
  await resetCounters();
  await db.transaction().execute(async (trx) => {
    await sql`set local time zone 'Pacific/Kiritimati'`.execute(trx);
    const utc = await sql<{
      day: string;
    }>`select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD') as day`.execute(
      trx,
    );
    assert.equal(await consumeAiBudget(8, 1, trx), utc.rows[0].day);
  });
  await db
    .insertInto("rate_limit")
    .values({ key: "ai:instance:day:2000-01-01", count: 10 })
    .execute();
  const before = (await usage("title")).uncostedCalls;
  await beginAttempt(current, "title", "chat");
  assert.equal((await usage("title")).uncostedCalls, before + 1);
  await resetCounters();
  await assert.rejects(admitMetadata(current, { userId: account.userId }));
  await denied(
    beginCheck(current, {
      actor: { userId: account.userId },
      intent: "test-again",
    }),
    "forbidden",
  );
  const admins: Actor[] = [account];
  for (let i = 0; i < 6; i++)
    admins.push(await actor("admin-" + i, "session-" + i));
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 10; i++) await admitMetadata(current, admins[j]);
  await denied(admitMetadata(current, admins[0]), "provider-rate");
  await denied(admitMetadata(current, admins[6]), "provider-rate");
  await resetCounters();
  const run = await db
    .insertInto("insight_reports")
    .values({
      owner: "worker",
      fence: "7",
      configToken: current.token,
      stage: "admitting",
      status: "running",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const owner = { runId: run.id, fence: "7", owner: "worker" };
  await db
    .insertInto("job_lease")
    .values({
      name: "insight:" + run.id,
      holder: owner.owner,
      fence: owner.fence,
      until: sql`now()+interval '5 minutes'`,
    })
    .execute();
  const reserve = (chunks: number) =>
    db.transaction().execute((trx) =>
      reserveInsightPlan(trx, current, owner, {
        snapshot: "fixture",
        groups: Array.from({ length: chunks }, (_, i) => [String(i)]),
      }),
    );
  await denied(reserve(8), "AI_PAUSED");
  const [one, two] = await Promise.all([reserve(2), reserve(2)]);
  assert.deepEqual(one, two);
  assert.equal(
    (
      await db
        .selectFrom("rate_limit")
        .where("key", "=", "ai:instance:day:" + day)
        .select("count")
        .executeTakeFirstOrThrow()
    ).count,
    3,
  );
  await denied(
    callChat("insights", prompt, { reservation: { ...one, fence: "6" } }),
    "RESERVATION_EXPIRED",
  );
  await callChat("insights", prompt, { reservation: one });
  assert.equal(mock.last.body.max_tokens, 4096);
  assert.equal((await usage("insights")).calls, 1);
  await db
    .updateTable("job_lease")
    .where("name", "=", "insight:" + run.id)
    .set({ until: sql`now()-interval '1 second'` })
    .execute();
  await denied(
    callChat("insights", prompt, { reservation: one }),
    "RESERVATION_EXPIRED",
  );
  await db
    .updateTable("job_lease")
    .where("name", "=", "insight:" + run.id)
    .set({ until: sql`now()+interval '5 minutes'` })
    .execute();
  await db
    .updateTable("insight_reports")
    .where("id", "=", run.id)
    .set({ reservationDay: "2000-01-01" })
    .execute();
  await denied(
    callChat("insights", prompt, { reservation: one }),
    "RESERVATION_EXPIRED",
  );
  const row = await db
    .selectFrom("insight_reports")
    .where("id", "=", run.id)
    .select(["reservationCount", "error"])
    .executeTakeFirstOrThrow();
  assert.equal(row.reservationCount, 2);
  assert.equal(row.error, null);
}
async function main() {
  const seed = await migrateAndSeed();
  runtimeState().authSecret = seed.authSecret;
  runtimeState().vector = seed.metadata;
  const mock = await mockOpenRouter();
  try {
    inputChecks();
    await identityChecks(mock);
    await wireChecks(mock);
    await responseChecks(mock);
    await concurrencyChecks(mock);
    await budgetChecks(mock);
    await resetCounters();
    await configurationRegressions(mock, account);
    await transportRegressions(mock, account);
    await accountingRegressions(mock, account);
    console.log("P08_CONTENT_CONTRACTS");
    const content = await contentContracts(mock, account);
    const sinks = [
      await db.selectFrom("moderation_event").selectAll().execute(),
      await db.selectFrom("ai_settings").select("lastCheck").execute(),
      await db.selectFrom("ai_health").selectAll().execute(),
      await db.selectFrom("insight_reports").select("error").execute(),
    ];
    assert(!JSON.stringify(sinks).includes("P07_PRIVATE_"));
    const unified = existsSync("/sys/fs/cgroup/cgroup.controllers");
    const cgroupValue = async (v2: string, v1: string) =>
      Number(
        (
          await readFile(
            "/sys/fs/cgroup/" + (unified ? v2 : "memory/" + v1),
            "utf8",
          )
        ).trim(),
      );
    const memory = await cgroupValue(
      "memory.peak",
      "memory.max_usage_in_bytes",
    );
    const limit = await cgroupValue("memory.max", "memory.limit_in_bytes");
    assert(
      memory > 0 && memory < limit && limit === 512 * 1024 * 1024,
      "AI worker exceeded the 512 MiB limit",
    );
    console.log(
      "P07_OUTCOME=" +
        JSON.stringify({
          content,
          transport: "verified TLS",
          identity: "passed",
          accounting: "passed",
          requestBounds: "passed",
          configurationRegressions: "passed",
          transportRegressions: "passed",
          accountingRegressions: "passed",
          privateMarkers: "absent",
          modelSlots: 8,
          visionSlots: 1,
          metadataSlots: 2,
          requests: mock.requests,
          peakBytes: memory,
          limitBytes: limit,
        }),
    );
  } finally {
    await mock.close();
    await db.destroy();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
