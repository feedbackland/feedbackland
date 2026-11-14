import assert from "node:assert/strict";
import { db } from "../../db/db";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k from "js-tiktoken/ranks/cl100k_base";
import {
  callChat,
  callEmbeddings,
  readProviderMetadata,
} from "../../lib/llm/client";
import {
  configuration,
  saveConfiguration,
  synchronizeAiEnvironment,
} from "../../lib/llm/settings-store";
import { defaults, inputBytes } from "../../lib/llm/defaults";
import { prepareEmbedding } from "../../lib/llm/model-profiles";
import { prepareChat } from "../../lib/llm/input-budgets";
import { MODEL_RESPONSE_BYTES } from "../../lib/llm/constants";
import { getConfig } from "../../lib/config";
import { runtimeState } from "../../lib/runtime-state";
import type { Actor } from "../../lib/auth/authorization";
import { chat, json, type mockOpenRouter } from "../mock-llm";

const prompt = { system: "Answer briefly", text: "fixture question" };
const verdict = JSON.stringify({
  isInappropriate: false,
  confidenceScore: 0.99,
});
type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
const usage = (feature: string) =>
  db
    .selectFrom("llm_usage")
    .selectAll()
    .where("feature", "=", feature)
    .executeTakeFirstOrThrow();

export async function transportRegressions(mock: Mock, actor: Actor) {
  const config = await configuration();
  for (const [source, reason, detail] of [
    ["openrouter_credits", null, "account-credit"],
    ["openrouter_key_limit", null, "key-limit"],
    ["openrouter_credits", "weight_exceeds_budget", "request-exceeds-balance"],
    ["unrecognized", null, undefined],
  ] as const) {
    mock.handler = ({ response }) =>
      json(
        response,
        { error: { metadata: { limit_source: source, reason } } },
        402,
      );
    await assert.rejects(callChat("check", prompt), {
      reason: "provider-credit",
      status: 402,
      creditDetail: detail,
    });
  }
  mock.handler = ({ response }) =>
    json(
      response,
      { error: { metadata: { limit_source: "openrouter_in_flight_budget" } } },
      402,
    );
  await assert.rejects(callChat("check", prompt), {
    reason: "in-flight-budget",
    status: 402,
  });
  for (const [error_type, reason] of [
    ["context_length_exceeded", "context-length"],
    ["invalid_request", "provider-input"],
  ] as const) {
    mock.handler = ({ response }) =>
      json(response, { error: { metadata: { error_type } } }, 400);
    await assert.rejects(
      callEmbeddings("backfill", ["valid row one", "valid row two"]),
      { reason, status: 400 },
    );
  }

  const key = {
    usage: 0,
    limit: null,
    limit_remaining: null,
    is_free_tier: true,
  };
  for (const fields of [
    {},
    { ...key, usage: "0" },
    { ...key, is_free_tier: "false" },
    { ...key, is_management_key: "true" },
    { ...key, expires_at: "invalid" },
    { ...key, limit: "none" },
  ]) {
    mock.handler = ({ response }) => json(response, { data: fields });
    await assert.rejects(readProviderMetadata("key"), {
      reason: "invalid-response",
    });
  }
  for (const [data, expired, management] of [
    [key, null, null],
    [
      {
        ...key,
        is_free_tier: false,
        is_management_key: true,
        expires_at: null,
      },
      false,
      true,
    ],
    [{ ...key, expires_at: "2020-01-01T00:00:00Z" }, true, null],
  ] as const) {
    mock.handler = ({ response }) => json(response, { data });
    const info = await readProviderMetadata("key");
    assert(!Array.isArray(info));
    assert.equal(info.expired, expired);
    assert.equal(info.management, management);
    assert.equal(info.limit, null);
    assert.equal(info.freeTier, data.is_free_tier);
  }
  mock.reset();
  for (const [feature, effort] of [
    ["moderation", "minimal"],
    ["title", "minimal"],
    ["rewrite", "minimal"],
    ["check", "minimal"],
    ["ask-ai", "low"],
  ] as const) {
    await callChat(feature, { ...prompt, system: "Moderate fixture" });
    assert.deepEqual(mock.last.body.reasoning, { effort });
  }
  const reference = new Tiktoken(cl100k);
  for (const source of [
    "客户反馈建议需要完整保留以便理解搜索质量".repeat(25) + "。\n完整结论。",
    "お客様の意見と検索結果の品質について報告します".repeat(20) +
      "。最終結論。",
    "dEaDbeEF0123456789".repeat(85) + "\nEnd.",
    "ab".repeat(750) + "💬 tail",
  ]) {
    const prepared = prepareEmbedding(defaults.embeddingModel, source)!;
    assert.equal(prepared.text, source);
    assert.equal(prepared.tokens, reference.encode(source, [], []).length);
  }
  for (const feature of ["insights", "ask-ai"] as const) {
    const p = prepareChat(feature, {
      ...prompt,
      items: ["", "one", "  ", "two"],
    });
    assert.equal(p.omitted, 2);
    assert(p.messages.some((m) => m.content.includes("one\ntwo")));
    const limited = prepareChat(feature, {
      ...prompt,
      text: "x".repeat(
        inputBytes[feature] - Buffer.byteLength(prompt.system) - 9,
      ),
      items: ["", "猫猫", " ", "a", "excess"],
    });
    assert.equal(limited.omitted, 3);
    assert(limited.messages.some((m) => m.content.endsWith("猫猫\na")));
    assert(
      Buffer.byteLength(limited.system) +
        limited.messages.reduce(
          (n, m) => n + Buffer.byteLength(m.content),
          0,
        ) <=
        inputBytes[feature],
    );
  }
  const history = [
    { role: "user" as const, content: "Earlier question" },
    { role: "assistant" as const, content: "Earlier answer" },
  ];
  const messages = async (text: string) => {
    await callChat("ask-ai", {
      ...prompt,
      text,
      history,
      items: ["Stable board corpus"],
    });
    return mock.last.body.messages as {
      role: string;
      content: string | { text: string; cache_control?: unknown }[];
    }[];
  };
  const first = await messages("Question one?"),
    second = await messages("Question two?");
  assert.deepEqual(first.slice(0, 2), second.slice(0, 2));
  assert.equal(first[0].role, "system");
  assert.equal(first[1].role, "user");
  const part = first[1].content;
  assert(Array.isArray(part));
  assert.equal(part[0].text, "Stable board corpus");
  assert(part[0].cache_control);
  assert.notDeepEqual(first.at(-1), second.at(-1));

  const health = () =>
    db
      .selectFrom("ai_health")
      .select(["lastReason", "lastAppliedSequence", "failingSince"])
      .where("configToken", "=", config.token)
      .where("capability", "=", "chat")
      .executeTakeFirstOrThrow();
  for (const [code, type, reason, cost] of [
    [429, "rate_limit_exceeded", "provider-rate", 0.042],
    [403, "refusal", "provider-refusal", 0],
    [403, "refusal", "provider-refusal", null],
  ] as const) {
    const before = await usage("ask-ai"),
      priorHealth = await health();
    mock.handler = ({ response }) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      const frame = {
        error: { code, message: "fixture", metadata: { error_type: type } },
        choices: [{ index: 0, delta: { content: "" }, finish_reason: "error" }],
        usage: {
          prompt_tokens: 9,
          completion_tokens: 2,
          total_tokens: 11,
          ...(cost === null ? {} : { cost }),
        },
      };
      response.end(
        "data: " +
          JSON.stringify({
            choices: [
              { index: 0, delta: { content: "partial" }, finish_reason: null },
            ],
          }) +
          "\n\ndata: " +
          JSON.stringify(frame) +
          "\n\ndata: [DONE]\n\n",
      );
    };
    await assert.rejects(callChat("ask-ai", prompt), { reason, status: code });
    const after = await usage("ask-ai");
    assert.equal(after.errors, before.errors + 1);
    assert.equal(
      after.uncostedCalls - before.uncostedCalls,
      cost === null ? 1 : 0,
    );
    assert.equal(BigInt(after.inputTokens) - BigInt(before.inputTokens), 9n);
    assert.equal(BigInt(after.outputTokens) - BigInt(before.outputTokens), 2n);
    assert(
      Math.abs(Number(after.costUsd) - Number(before.costUsd) - (cost ?? 0)) <
        1e-10,
    );
    if (code === 403) assert.deepEqual(await health(), priorHealth);
    else assert.equal((await health()).lastReason, reason);
  }
  for (const [text, finish] of [
    ["plain text", "stop"],
    ['{"isInappropriate":false}', "stop"],
    [verdict, "length"],
    ['{"broken":', "stop"],
  ]) {
    mock.handler = ({ response }) => chat(response, 0.001, finish, text);
    const before = await usage("moderation");
    await assert.rejects(callChat("moderation", prompt), {
      reason: "invalid-response",
    });
    const after = await usage("moderation");
    assert.equal(after.errors, before.errors + 1);
    assert.equal(after.uncostedCalls, before.uncostedCalls);
    assert.equal((await health()).lastReason, "provider-error");
  }
  mock.handler = ({ response }) =>
    chat(
      response,
      0.001,
      "stop",
      "\x60\x60\x60json\n" + verdict + "\n\x60\x60\x60",
    );
  await callChat("moderation", prompt);
  assert.equal((await health()).failingSince, null);
  mock.reset();

  await saveConfiguration(actor, await configuration(), {
    options: { timeoutMs: 1000 },
  });
  mock.handler = ({ response }) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(": still connected\n\n");
  };
  for (const callback of [undefined, () => {}]) {
    const started = performance.now();
    await assert.rejects(callChat("ask-ai", prompt, { onText: callback }), {
      reason: "timeout",
    });
    assert(performance.now() - started < 3000);
    assert.equal(runtimeState().aiWork?.model, 0);
  }
  mock.reset();
  await saveConfiguration(actor, await configuration(), {
    options: { timeoutMs: 15000 },
  });
  const mixed = await callEmbeddings("backfill", ["", "alpha", " ", "beta"]);
  assert.deepEqual(mixed, [null, [1, 1, 1], null, [2, 2, 2]]);
  const noRequest = mock.requests;
  assert.deepEqual(await callEmbeddings("backfill", ["", " "]), [null, null]);
  assert.equal(mock.requests, noRequest);

  const state = runtimeState(),
    original = state.vector!;
  const sync = async (width: number) => {
    process.env.AI_EMBEDDING_DIMENSIONS = String(width);
    state.vector = { ...original, dimensions: width };
    delete state.aiConfig;
    assert(
      await db
        .transaction()
        .execute((t) => synchronizeAiEnvironment(t, getConfig().authSecret)),
    );
  };
  try {
    for (const width of [768, 1536, 3072]) {
      await sync(width);
      let sent = 0;
      mock.handler = ({ response, body }) => {
        const ids = body.input as string[];
        const data = ids
          .map((value, index) => ({
            index,
            embedding: Array.from(
              { length: width },
              () => Number(value) + 0.0123456789,
            ),
          }))
          .reverse();
        const result = {
          model: "fixture",
          data,
          usage: { prompt_tokens: ids.length, cost: 0.0001 },
        };
        assert(
          Buffer.byteLength(JSON.stringify(result)) <= MODEL_RESPONSE_BYTES,
        );
        sent++;
        json(response, result);
      };
      const before = await usage("backfill");
      const vectors = await callEmbeddings(
        "backfill",
        Array.from({ length: 64 }, (_, i) => String(i)),
      );
      assert(sent > 1);
      assert.equal((await usage("backfill")).calls - before.calls, sent);
      vectors.forEach((v, i) => {
        assert.equal(v?.length, width);
        assert.equal(v?.[0], i + 0.0123456789);
      });
    }
  } finally {
    await sync(original.dimensions);
    mock.reset();
  }
}
