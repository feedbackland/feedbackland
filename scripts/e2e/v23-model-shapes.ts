import assert from "node:assert/strict";
import { largeRequestScenarios } from "../../lib/ai-cost-scenarios";
import { prepareChat, planVision } from "../../lib/llm/input-budgets";
import { embeddingBatch, prepareEmbedding } from "../../lib/llm/model-profiles";
import {
  embeddingRequestLimit,
  outputTokens,
} from "../../lib/ai-request-limits";
import { releaseFixtures } from "../ai-release-fixtures";
import { releaseRequestShapes, runReleaseShape } from "../ai-release-shapes";
import { calibrationClient } from "../../lib/llm/client";
import { defaults } from "../../lib/llm/defaults";
import { OPENROUTER_API } from "../../lib/llm/constants";

const model = "openai/text-embedding-3-small";
const ascii = (bytes: number) => "x".repeat(bytes);
const textBytes = (messages: { content: string }[]) =>
  messages.reduce((size, m) => size + Buffer.byteLength(m.content), 0);

async function verifyWireMaximums() {
  const options = {
    ...defaults,
    model: "fixture/maximum",
    privacy: "deny" as const,
  };
  const costs = [];
  for (const shape of releaseRequestShapes()) {
    let requests = 0;
    let wireBytes = 0;
    const client = calibrationClient("fixture-key", async (input, init) => {
      requests++;
      assert.equal(input, OPENROUTER_API + "/chat/completions");
      assert(typeof init?.body === "string");
      wireBytes = Buffer.byteLength(init.body);
      const body = JSON.parse(init.body);
      assert.equal(body.model, options.model);
      assert.equal(body.provider.data_collection, "deny");
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.max_tokens, shape.images ? 1024 : 4096);
      const [system, user] = body.messages;
      assert.equal(body.messages.length, 2);
      assert.equal(system.role, "system");
      assert.equal(system.content, shape.input.system);
      assert.equal(user.role, "user");
      if (shape.images) {
        assert.equal(
          Buffer.byteLength(system.content) +
            Buffer.byteLength(user.content[0].text),
          48000,
        );
        assert.equal(user.content[0].text, shape.input.text);
        assert.equal(user.content.length, 5);
        const images = new Set();
        for (const part of user.content.slice(1)) {
          assert.equal(part.type, "image_url");
          const url: string = part.image_url.url;
          assert(url.startsWith("data:image/png;base64,"));
          const decoded = Buffer.from(
            url.slice("data:image/png;base64,".length),
            "base64",
          );
          assert.equal(decoded.length, 1_000_000);
          assert.equal(decoded.readUInt32BE(16), 2000);
          assert.equal(decoded.readUInt32BE(20), 2000);
          images.add(url);
        }
        assert.equal(images.size, 4);
        assert(wireBytes > 5_380_000 && wireBytes < 6_000_000);
      } else {
        assert.deepEqual(body.reasoning, { effort: "medium", exclude: true });
        assert.equal(user.content, shape.input.text);
        const bytes =
          Buffer.byteLength(system.content) + Buffer.byteLength(user.content);
        assert(
          bytes >= 63000 && bytes <= 64000,
          shape.id + " used " + bytes + " text bytes",
        );
        const rows = JSON.parse(user.content);
        if (shape.id.endsWith("chunk")) {
          assert.deepEqual(
            rows.map((row: { id: number }) => row.id),
            Array.from({ length: rows.length }, (_, i) => i + 1),
          );
          assert.equal(rows[0].description.length, 700);
        } else {
          assert.deepEqual(
            rows.map((row: { index: number }) => row.index),
            Array.from({ length: 200 }, (_, i) => i),
          );
          assert.equal(rows[0].description.length, 115);
        }
      }
      return Response.json({
        model: options.model,
        provider: "Fixture",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: shape.reply },
          },
        ],
        usage: { prompt_tokens: 15001, completion_tokens: 37, cost: 0.00123 },
      });
    });
    const result = await runReleaseShape(client, shape, options);
    assert.equal(result.failure, undefined, shape.id);
    assert(result.value);
    assert.deepEqual(result.usage, {
      inputTokens: 15001,
      outputTokens: 37,
      cost: 0.00123,
    });
    assert.equal(result.receipt?.model, options.model);
    assert.equal(requests, 1, shape.id);
    costs.push({ case: shape.id, wireBytes, requests, usage: result.usage });
  }
  return costs;
}

export async function verifyModelShapes() {
  const prepared = await releaseFixtures();
  // Independent boundary fixtures. Changes to documented allowances require
  // deliberate review of cost and provider limits, including the next byte.
  const expected = {
    moderation: [48000, 1024],
    title: [48000, 1024],
    rewrite: [48000, 2048],
    insights: [64000, 4096],
    "ask-ai": [128000, 4096],
    check: [48000, 64],
  } as const;
  const system = "fixture";
  for (const [feature, [bytes, tokens]] of Object.entries(expected) as [
    keyof typeof expected,
    (typeof expected)[keyof typeof expected],
  ][]) {
    const limit = ascii(bytes - system.length);
    assert.equal(
      textBytes(prepareChat(feature, { system, text: limit }).messages) +
        system.length,
      bytes,
    );
    assert.throws(
      () => prepareChat(feature, { system, text: limit + "x" }),
      /invalid-input/,
    );
    assert.throws(
      () => prepareChat(feature, { system, text: "\ud800" }),
      /invalid-input/,
    );
    assert.equal(outputTokens[feature], tokens);
  }
  const chat = prepareChat("ask-ai", {
    system,
    text: "🧪".repeat(1000),
    history: Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: "é".repeat(1000),
    })),
    items: Array.from({ length: 310 }, () => "界".repeat(401)),
  });
  assert(chat.cacheCorpus);
  assert.equal(chat.messages.length, 10);
  assert(chat.messages.every((m) => m.content.isWellFormed()));
  assert(textBytes(chat.messages) + system.length <= 128000);
  assert(textBytes(chat.messages) + system.length > 126800);
  assert(chat.omitted > 10);
  const countCap = prepareChat("ask-ai", {
    system,
    text: "Question",
    items: Array.from({ length: 310 }, () => "Short post"),
  });
  assert.equal(countCap.messages[0].content.split("\n").length, 300);
  const insight = prepareChat("insights", {
    system,
    text: "Summarise",
    items: Array.from({ length: 205 }, () => "Short report item"),
  });
  assert.equal(insight.omitted, 5);
  const images = Array.from({ length: 4 }, (_, i) => ({
    id: String(i),
    byteSize: 1_000_000,
    width: 2000,
    height: 2000,
    contentType: "image/png",
    load: async () => {
      throw new Error("shape inspection must not load image bytes");
    },
  }));
  assert.equal(planVision(images).length, 4);
  assert.throws(
    () => planVision([...images, { ...images[0], id: "5" }]),
    /invalid-input/,
  );
  assert.throws(
    () => planVision([{ ...images[0], byteSize: 1_000_001 }]),
    /invalid-input/,
  );
  assert.throws(
    () => planVision([{ ...images[0], height: 2001 }]),
    /invalid-input/,
  );
  const perPost = " a".repeat(8001);
  const boundedPost = prepareEmbedding(model, perPost)!;
  assert.equal(boundedPost.tokens, 8000);
  const query = prepareEmbedding(model, "🚲".repeat(201), true)!;
  assert.equal(Array.from(query.text).length, 200);
  assert.equal(query.bytes, 800);
  assert.equal(embeddingBatch(model, Array(4).fill(perPost)).length, 4);
  assert.throws(
    () => embeddingBatch(model, Array(5).fill(perPost)),
    /invalid-input/,
  );
  const depths = [
    { width: 768, wireItems: 53, batches: 2, splitAttempts: 316 },
    { width: 3072, wireItems: 13, batches: 5, splitAttempts: 310 },
    { width: 4000, wireItems: 10, batches: 7, splitAttempts: 306 },
  ];
  for (const row of depths) {
    assert.equal(embeddingRequestLimit(row.width), row.wireItems);
    const known = [
      {
        id: model,
        inputPrice: "0.000001",
        outputPrice: null,
        requestPrice: "0.002",
      },
    ];
    const scenarios = largeRequestScenarios(
      "fixture/chat",
      model,
      known,
      row.width,
    );
    const batch = scenarios.find((item) => item.feature === "Backfill batch")!;
    const split = scenarios.find((item) =>
      item.feature.includes("split retries"),
    )!;
    assert.match(
      batch.shape,
      new RegExp(
        "32,000 input tokens total across " + row.batches + " requests",
      ),
    );
    assert.equal(batch.cost, 32000 * 0.000001 + row.batches * 0.002);
    assert(split.shape.includes(row.splitAttempts + " requests"));
    assert(split.cost! > batch.cost!);
    const moderation = scenarios.find((item) =>
      item.feature.includes("text-only fallback"),
    )!;
    assert.match(
      moderation.shape,
      /48,000 input bytes, 1,024 output tokens × 2 attempts/,
    );
    assert.equal(moderation.cost, null);
    assert(
      largeRequestScenarios(
        "fixture/chat",
        model,
        [{ ...known[0], requestPrice: null }],
        row.width,
      ).every((item) => item.cost === null),
    );
  }
  return {
    fixtures: {
      selection: prepared.selection.length,
      heldOut: prepared.heldOut.length,
      languages: new Set(prepared.heldOut.map((row) => row.language)).size,
      search: prepared.search.length,
      hashes: prepared.hashes,
    },
    maximums: {
      chatTextBytesAndOutputTokens: expected,
      vision: {
        images: images.length,
        rawBytes: 4_000_000,
        pixelsPerImage: 4_000_000,
      },
      embeddingTokens: { perPost: boundedPost.tokens, perBatch: 32_000 },
      embeddingWidths: depths,
      serialized: await verifyWireMaximums(),
    },
  };
}

if (process.argv.includes("--standalone"))
  void verifyModelShapes()
    .then((evidence) => console.log(JSON.stringify(evidence)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
