import assert from "node:assert/strict";
import { sql } from "kysely";
import { db } from "../../db/db";
import { getConfig } from "../../lib/config";
import { runtimeState } from "../../lib/runtime-state";
import {
  callChat,
  callEmbeddings,
  readProviderMetadata,
} from "../../lib/llm/client";
import {
  beginCheck,
  beginCreditWait,
  completeCreditWait,
  configuration,
  failingCapability,
  refreshConfigurationLease,
  renewConfigurationLease,
  saveCheck,
  saveConfiguration,
  synchronizeAiEnvironment,
} from "../../lib/llm/settings-store";
import type { Actor } from "../../lib/auth/authorization";
import { firstKey, secondKey, json, type mockOpenRouter } from "../mock-llm";

type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
const good = { key: "valid", chat: "passed", search: "passed" } as const;
const bad = { key: "invalid", chat: "failed", search: "untested" } as const;
const prompt = { system: "Answer briefly", text: "fixture question" };

export async function configurationRegressions(mock: Mock, actor: Actor) {
  const state = runtimeState(),
    secret = getConfig().authSecret;
  const sync = async () => {
    delete state.aiConfig;
    return db
      .transaction()
      .execute((trx) => synchronizeAiEnvironment(trx, secret));
  };
  const expire = () =>
    db
      .updateTable("job_lease")
      .where("name", "like", "ai-config:%")
      .set({ until: sql`clock_timestamp()-interval '1 second'` })
      .execute();
  const manual = { actor, intent: "configure" } as const;
  delete process.env.OPENROUTER_API_KEY;
  await expire();
  await sync();
  await saveConfiguration(actor, await configuration(), {
    enabled: false,
    options: { dailyCallLimit: 5000 },
  });
  const stamp = () =>
    db
      .selectFrom("ai_settings")
      .select(["enabled", "keepOffAt", "keepOffBy"])
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
  const kept = await stamp();
  await saveConfiguration(actor, await configuration(), { apiKey: null });
  assert.deepEqual(await stamp(), kept);
  process.env.OPENROUTER_API_KEY = firstKey;
  await sync();
  await assert.rejects(callChat("title", prompt), {
    reason: "AI_NOT_CONFIGURED",
  });
  await saveCheck(await beginCheck(await configuration(), manual), good);
  await saveConfiguration(actor, await configuration(), { enabled: true });
  mock.expectedKey = firstKey;

  const original = await configuration();
  mock.handler = ({ response }) =>
    json(response, { error: { code: 401 } }, 401);
  await assert.rejects(callChat("title", prompt), { reason: "provider-auth" });
  await db
    .updateTable("ai_health")
    .where("configToken", "=", original.token)
    .where("capability", "=", "chat")
    .set({ failingSince: sql`clock_timestamp()-interval '16 minutes'` })
    .execute();
  assert(await failingCapability(original, "chat"));
  const obsolete = await beginCheck(original, manual);
  await db
    .transaction()
    .execute((trx) => renewConfigurationLease(trx, "fixture-serving-a"));
  process.env.OPENROUTER_API_KEY = secondKey;
  assert.equal(await sync(), false);
  await expire();
  assert.equal(
    await db
      .transaction()
      .execute((trx) => refreshConfigurationLease(trx, secret, "fixture-b")),
    false,
  );
  process.env.OPENROUTER_API_KEY = firstKey;
  delete state.aiConfig;
  assert.equal((await configuration()).token, original.token);
  assert(
    await db
      .transaction()
      .execute((trx) =>
        refreshConfigurationLease(trx, secret, "fixture-serving-a"),
      ),
  );
  await expire();
  process.env.OPENROUTER_API_KEY = secondKey;
  assert(await sync());
  process.env.OPENROUTER_API_KEY = firstKey;
  assert(await sync());
  const restored = await configuration();
  assert.notEqual(restored.token, original.token);
  assert.equal(restored.revision, original.revision);
  assert.equal(await failingCapability(restored, "chat"), false);
  assert.equal(await saveCheck(obsolete, bad), false);
  mock.reset();

  delete process.env.AI_EMBEDDING_DIMENSIONS;
  assert(await sync());
  assert.equal((await configuration()).widthMismatch, false);
  await callEmbeddings("probe", ["width"]);
  assert.equal(mock.last.body.dimensions, 3);
  process.env.AI_EMBEDDING_DIMENSIONS = "4";
  assert(await sync());
  await assert.rejects(callEmbeddings("probe", ["width"]), {
    reason: "AI_UNAVAILABLE",
  });
  process.env.AI_EMBEDDING_DIMENSIONS = "3";
  delete process.env.OPENROUTER_API_KEY;
  assert(await sync());
  await saveConfiguration(actor, await configuration(), { apiKey: firstKey });
  mock.expectedKey = firstKey;
  const pending = await configuration();
  assert.equal(pending.enabled, null);
  const sent = mock.requests;
  await assert.rejects(beginCheck(pending), { reason: "AI_NOT_CONFIGURED" });
  await assert.rejects(callChat("check", prompt), {
    reason: "AI_NOT_CONFIGURED",
  });
  await assert.rejects(callEmbeddings("probe", ["sample"]), {
    reason: "AI_NOT_CONFIGURED",
  });
  await assert.rejects(readProviderMetadata("key"), {
    reason: "AI_NOT_CONFIGURED",
  });
  assert.equal(mock.requests, sent);
  const initial = await beginCheck(pending, manual);
  const until = await beginCreditWait(initial);
  assert(until);
  const waiting = await beginCheck(pending);
  await readProviderMetadata("key", undefined, undefined, waiting);
  await callChat("check", prompt, { check: waiting });
  await callEmbeddings("check", ["sample"], { check: waiting });
  await assert.rejects(
    callEmbeddings("probe", ["sample"], { check: waiting }),
    { reason: "invalid-input" },
  );
  const beforeExpiry = mock.requests;
  await db
    .updateTable("ai_settings")
    .set({ creditWaitUntil: sql`clock_timestamp()-interval '1 second'` })
    .where("id", "=", 1)
    .execute();
  await assert.rejects(callChat("check", prompt, { check: waiting }), {
    reason: "AI_NOT_CONFIGURED",
  });
  await assert.rejects(
    readProviderMetadata("key", undefined, undefined, waiting),
    { reason: "AI_NOT_CONFIGURED" },
  );
  assert.equal(mock.requests, beforeExpiry);
  const older = await beginCheck(pending, manual);
  assert(await beginCreditWait(older));
  const newer = await beginCheck(pending);
  assert(await saveCheck(newer, bad));
  assert.equal(await saveCheck(older, good), false);
  assert.equal(
    await completeCreditWait(older, pending.keyDigest!, until, good),
    null,
  );
  assert.equal((await configuration()).enabled, null);
  const latest = await beginCheck(pending, manual);
  assert(await saveCheck(latest, good));
  assert.equal(await saveCheck(newer, bad), false);
  assert(await completeCreditWait(latest, pending.keyDigest!, until, good));
  assert.equal((await configuration()).check?.key, "valid");

  await saveConfiguration(actor, await configuration(), {
    options: { model: "fixture/model" },
  });
  await readProviderMetadata("chatModels", actor);
  assert.equal((await configuration()).options.vision, true);
  await callChat(
    "moderation",
    { system: "Moderate fixture", text: "hello" },
    {
      images: [
        {
          id: "one",
          width: 1,
          height: 1,
          contentType: "image/png",
          byteSize: 1,
          load: async () => Buffer.from([1]),
        },
      ],
    },
  );
  await saveConfiguration(actor, await configuration(), {
    options: { model: "fixture/text" },
    selectedModel: { id: "fixture/text", vision: false },
  });
  assert.equal((await configuration()).options.vision, false);
  await saveConfiguration(actor, await configuration(), {
    options: { model: "fixture/model", vision: false },
    selectedModel: { id: "fixture/model", vision: true },
  });
  assert.equal((await configuration()).options.vision, false);

  await db.deleteFrom("rate_limit").where("key", "like", "ai%").execute();
  for (let i = 0; i < 4; i++) {
    const check = await beginCheck(await configuration(), manual);
    await readProviderMetadata("key", undefined, undefined, check);
    if (i === 0) {
      const success = mock.handler;
      mock.handler = ({ response }) => {
        mock.handler = success;
        json(
          response,
          {
            error: { message: "No endpoints found matching your data policy" },
          },
          404,
        );
      };
    }
    await callChat("check", prompt, { check });
    await callEmbeddings("check", ["test"], { check });
  }
  const counters = await db
    .selectFrom("rate_limit")
    .select(["key", "count"])
    .where("key", "like", "ai%")
    .execute();
  assert.equal(
    counters.find((c) => c.key === "ai-check:user:" + actor.userId)?.count,
    4,
  );
  assert.equal(counters.find((c) => c.key === "ai:metadata:minute")?.count, 4);
  assert.equal(
    counters.find((c) => c.key.startsWith("ai:instance:day:"))?.count,
    9,
  );
}
