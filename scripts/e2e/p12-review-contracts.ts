import { releaseRequestShapes } from "../ai-release-shapes";
import assert from "node:assert/strict";
import { DefaultChatTransport } from "ai";
import {
  askAiErrorCopy,
  askAiQuestionTooLong,
  askAiTextTurns,
  extractCitedPostIds,
  rewriteCitationsForCopy,
} from "../../lib/ask-ai";
import { prepareAskAiQuery, askAiFailure } from "../../lib/llm/ask-ai";
import { DomainError } from "../../lib/domain-error";
import { prepareChat } from "../../lib/llm/input-budgets";
import {
  activateStoredThread,
  readStoredThread,
  saveStoredThread,
  clearStoredThread,
} from "../../components/app/ask-ai/storage";
import { calibrationClient } from "../../lib/llm/client";
import { connectionChat } from "../../lib/ai-request-limits";
import { defaults } from "../../lib/llm/defaults";
import { validateConnectionReply } from "../../lib/llm/connection-check";
import {
  assertIndependentFamilies,
  releaseFixtures,
  type ModerationFixture,
} from "../ai-release-fixtures";
import {
  chooseMeasuredCandidate,
  estimateEmbeddingCost,
  measureRelease,
} from "../measure-ai";
import { measureSearchDistances, searchCutoff } from "../ai-calibration-search";
import { outboundDestinations } from "./fixtures/network-attempts.mjs";
import { cleanupNetworkFixture } from "./v16-egress";

const caseOptions = { ...defaults, model: "fixture/qualified" };
const harmless = "A routine board question";
const first = "efc8007b-0df1-45bb-87c6-c615bc91e324";
const other = "e35be329-4480-4537-bf6e-b277594fc437";
const textPart = (text: string) => [{ type: "text" as const, text }];
const asked = [
  { id: "question", role: "user" as const, parts: textPart(harmless) },
];

async function chatContracts() {
  const values = new Map<string, string>();
  const prior = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        setItem: (key: string, value: string) => values.set(key, value),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
      },
    },
  });
  try {
    values.set("feedbackland-ask-ai:board", JSON.stringify(asked));
    activateStoredThread("first");
    assert(!values.has("feedbackland-ask-ai:board"));
    saveStoredThread("first", asked);
    activateStoredThread("first");
    assert.deepEqual(readStoredThread("first"), asked);
    activateStoredThread("second");
    assert.deepEqual(readStoredThread("second"), []);
    assert.deepEqual(readStoredThread("first"), []);
    saveStoredThread("first", asked);
    assert.equal(values.size, 0);
    saveStoredThread("second", asked);
    clearStoredThread("first");
    assert.deepEqual(readStoredThread("second"), asked);
    clearStoredThread("second");
    saveStoredThread("second", asked);
    assert.equal(values.size, 0);
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("Disabled in this browser");
      },
    });
    activateStoredThread("blocked");
    assert.deepEqual(readStoredThread("blocked"), []);
    saveStoredThread("blocked", asked);
    clearStoredThread("blocked");
  } finally {
    if (prior) Object.defineProperty(globalThis, "window", prior);
    else Reflect.deleteProperty(globalThis, "window");
  }

  const record = JSON.stringify({
    id: first,
    title: "T".repeat(300),
    feedback: "界".repeat(400),
  });
  const input = {
    system: "System",
    text: harmless,
    items: Array(300).fill(record),
  };
  const withRoom = prepareChat("ask-ai", input);
  const withoutRoom = prepareChat("ask-ai", {
    ...input,
    text: "x".repeat(4000),
    history: Array.from({ length: 4 }, () => ({
      role: "user" as const,
      content: "y".repeat(4000),
    })),
  });
  const packed = withoutRoom.messages[0].content.split("\n");
  assert(withoutRoom.included < 300);
  assert.equal(withoutRoom.included, packed.length);
  assert.equal(packed[0], record);
  assert(packed.every((line) => JSON.parse(line).feedback.length === 400));
  assert.equal(withRoom.messages[0].content, withoutRoom.messages[0].content);

  let wireBytes = 0;
  const transport = new DefaultChatTransport({
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { messages: askAiTextTurns(messages) },
    }),
    fetch: async (_resource, init) => {
      const body = String(init?.body);
      wireBytes = Buffer.byteLength(body);
      const turns = JSON.parse(body).messages as typeof asked;
      assert.equal(turns.at(-1)?.parts[0].text, harmless);
      assert.equal(turns.length, 5);
      assert(
        turns
          .slice(0, -1)
          .every((turn) => Buffer.byteLength(turn.parts[0].text) === 4000),
      );
      return new Response("Fixture stops before the stream", { status: 400 });
    },
  });
  await assert.rejects(
    transport.sendMessages({
      trigger: "submit-message",
      chatId: "fixture",
      abortSignal: undefined,
      messageId: undefined,
      messages: [
        ...Array.from({ length: 85 }, (_, i) => ({
          id: String(i),
          role: i % 2 ? ("assistant" as const) : ("user" as const),
          parts: textPart("x".repeat(15000)),
        })),
        ...asked,
      ],
    }),
    /Fixture stops/,
  );
  assert(wireBytes > 15000 && wireBytes < 18000);
  assert(!askAiQuestionTooLong("🧪".repeat(1000)));
  assert(askAiQuestionTooLong("🧪".repeat(1001)));
  assert.throws(
    () => askAiTextTurns([{ ...asked[0], parts: textPart("🧪".repeat(1001)) }]),
    /INVALID_CHAT_INPUT/,
  );

  const answer =
    "First [1](post:" + first + "). Other [2](post:" + other + ").";
  assert.deepEqual(extractCitedPostIds(answer, [first]), [first]);
  const copy = rewriteCitationsForCopy(
    answer,
    "https://board.example.invalid",
    [first],
  );
  assert(copy.includes("/" + first) && !copy.includes(other));
  assert.match(
    askAiErrorCopy(
      '{"error":"AI_PAUSED","resetsAt":"2030-01-01T00:00:00.000Z"}',
    ).text,
    /^Paused until /,
  );
  assert.equal(
    askAiErrorCopy('{"error":"AI_BUSY"}').text,
    "Ask AI is busy. Try again shortly.",
  );
  assert(
    !JSON.stringify(
      askAiErrorCopy('{"error":"synthetic provider diagnostics"}'),
    ).includes("synthetic provider"),
  );

  const elapsed = AbortSignal.abort(
    new DOMException("Fixture deadline", "TimeoutError"),
  );
  const live = new AbortController();
  const cancelled = new DomainError(
    "CLIENT_CLOSED_REQUEST",
    "REQUEST_CANCELLED",
  );
  const stopped = () => Promise.reject(cancelled);
  const error = await prepareAskAiQuery(elapsed, live.signal, stopped).catch(
    (cause) => cause,
  );
  const mapped = askAiFailure(error);
  assert.equal(mapped.status, 503);
  assert.equal(mapped.headers.get("retry-after"), "1");
  live.abort();
  await assert.rejects(
    prepareAskAiQuery(elapsed, live.signal, stopped),
    (error) => error === cancelled,
  );

  const caller = (delta: string, finish: string) =>
    calibrationClient("private-fixture", async () => {
      const frame = (content: unknown, reason: string | null) => ({
        id: "fixture-stream",
        model: caseOptions.model,
        created: 1,
        choices: [{ index: 0, delta: content, finish_reason: reason }],
      });
      return new Response(
        [
          "data: " + JSON.stringify(frame({ content: delta }, null)),
          "data: " + JSON.stringify(frame({}, finish)),
          "data: [DONE]",
        ].join("\n\n") + "\n\n",
        { headers: { "content-type": "text/event-stream" } },
      );
    });
  assert.equal(
    (await caller(" \t", "stop").chat("ask-ai", input, caseOptions)).failure
      ?.reason,
    "invalid-response",
  );
  assert.equal(
    (await caller(harmless, "length").chat("ask-ai", input, caseOptions)).value
      ?.truncated,
    true,
  );
  return {
    scopedStorage: true,
    corpusRows: packed.length,
    wireBytes,
    verifiedSources: true,
    mappedErrors: true,
  };
}

const qualified = "fixture/low-observed",
  expensive = "fixture/low-quote";
const basis = [
  { model: expensive, quote: 0.000001 },
  { model: qualified, quote: 0.000002 },
];
const sampleKey = {
  limit: 2,
  limit_remaining: 2,
  limit_reset: null,
  is_free_tier: false,
  include_byok_in_limit: true,
};
function provider(
  fixtures: Awaited<ReturnType<typeof releaseFixtures>>,
  { fence = false, cap = true }: { fence?: boolean; cap?: boolean } = {},
) {
  const samples = [...fixtures.selection, ...fixtures.heldOut];
  const requests: string[] = [];
  const shapes = releaseRequestShapes();
  const call: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://openrouter.ai");
    if (url.pathname.endsWith("/key"))
      return Response.json({
        data: { ...sampleKey, include_byok_in_limit: cap },
      });
    if (url.search)
      return Response.json({
        data: [
          {
            id: defaults.embeddingModel,
            pricing: { prompt: "0.000001", request: "0.000002" },
          },
        ],
      });
    if (url.pathname.endsWith("/models/user"))
      return Response.json({
        data: basis.map(({ model, quote }) => ({
          id: model,
          context_length: 200000,
          canonical_slug: model,
          architecture: {
            input_modalities: ["text", "image"],
            output_modalities: ["text"],
          },
          pricing: { prompt: quote, completion: quote, request: 0 },
        })),
      });
    assert.equal(typeof init?.body, "string");
    const body = JSON.parse(init!.body as string);
    assert.equal(body.provider.data_collection, "deny");
    requests.push(url.pathname);
    if (url.pathname.endsWith("/embeddings")) {
      assert.equal(body.input.length, 1);
      assert.equal(body.dimensions, 768);
      const unrelated = fixtures.search.some(
        (pair) =>
          pair.expected === "unrelated" && body.input[0].includes(pair.post),
      );
      return Response.json({
        model: defaults.embeddingModel,
        usage: { prompt_tokens: 12, total_tokens: 12 },
        data: [
          {
            index: 0,
            embedding: Array.from({ length: 768 }, (_, i) =>
              i === (unrelated ? 1 : 0) ? 1 : 0,
            ),
          },
        ],
      });
    }
    assert(url.pathname.endsWith("/chat/completions"));
    const prompt = body.messages[0].content;
    const raw = body.messages.at(-1).content;
    const text = typeof raw === "string" ? raw : raw[0].text;
    const fixture: ModerationFixture | undefined = samples.find(
      (row) =>
        text === row.text ||
        text.startsWith(row.text + "\n\nProposed heading:\n"),
    );
    const shape = shapes.find(
      (shape) => shape.input.system === prompt && shape.input.text === text,
    );
    let content: string;
    if (prompt === connectionChat.system) {
      assert.equal(body.max_tokens, 64);
      content = fence
        ? String.fromCharCode(96).repeat(3) +
          "json\n" +
          '{"ok":true}' +
          "\n" +
          String.fromCharCode(96).repeat(3)
        : '{"ok":true}';
    } else if (shape) {
      content = shape.reply;
    } else {
      assert(fixture);
      content = JSON.stringify(
        prompt.startsWith("Create")
          ? {
              title: "A distinct fixture heading " + fixture.id,
              category: fixture.category,
            }
          : {
              isInappropriate: fixture.verdict === "refuse",
              confidenceScore: 0.99,
              titleApproved: true,
            },
      );
    }
    return Response.json({
      model: body.model,
      provider: "Fixture",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content },
        },
      ],
      usage: {
        prompt_tokens: 22,
        completion_tokens: 12,
        cost: body.model === expensive ? 0.0002 : 0.0001,
      },
    });
  };
  return { call, requests };
}

async function calibrationContracts() {
  const fixtures = await releaseFixtures();
  const setup = {
    key: "private-fixture",
    fixtures,
    date: "2030-04-27T00:00:00.000Z",
    sourceCommit: "fixture",
  };
  const limits = { maxUsd: 2, maxRequests: 450, maxCandidates: 2 };
  const run = (
    options?: Parameters<typeof provider>[1],
    overrides: Partial<Parameters<typeof measureRelease>[0]["bounds"]> = {},
  ) => {
    const mock = provider(fixtures, options);
    const snapshots: { state: string; attempts: number }[] = [];
    return measureRelease({
      ...setup,
      transport: mock.call,
      bounds: { ...limits, ...overrides },
      checkpoint: async (state) => {
        const report = state as { status: string; attempts: unknown[] };
        snapshots.push({
          state: report.status,
          attempts: report.attempts.length,
        });
      },
    }).then((result) => ({ result, snapshots, requests: mock.requests }));
  };
  const measured = await run();
  assert.equal(
    measured.result.status,
    "measured",
    measured.result.error ?? "calibration result",
  );
  assert.equal(
    chooseMeasuredCandidate(measured.result.candidates)?.model,
    qualified,
  );
  assert.equal(measured.result.candidates[0].model, expensive);
  assert(
    measured.result.candidates.every(({ titles }) =>
      titles.every(({ heading }) => heading),
    ),
  );
  type Search = ReturnType<typeof searchCutoff>;
  type Snapshot = { usdPer100TextPosts: number; embeddingSource: string };
  const evidence = measured.result.result as {
    search: Search;
    priceSnapshot: Snapshot;
  };
  assert.equal(evidence.search.searchMaxDistance, 0.5);
  assert.equal(evidence.search.currentIsMeasuredMidpoint, false);
  assert.equal(evidence.search.currentSeparates, true);
  assert.equal(
    evidence.priceSnapshot.embeddingSource,
    "reported-and-listed-token-prices",
  );
  assert(Math.abs(evidence.priceSnapshot.usdPer100TextPosts - 0.0214) < 1e-9);
  assert.equal(
    measured.requests.filter((url) => url.endsWith("/embeddings")).length,
    61,
  );
  assert.equal(measured.result.unpricedRequests, 61);
  assert.deepEqual(
    measured.result.maximumShapes,
    releaseRequestShapes().map(({ id }) => ({ id, passed: true })),
  );
  assert.equal(
    estimateEmbeddingCost([{ inputTokens: null, costUsd: null }], {
      prompt: 1,
      request: 1,
    }),
    null,
  );

  const mismatch = await run({ fence: true });
  assert.match(
    mismatch.result.error ?? "",
    /production vision connection check/,
  );
  assert(
    mismatch.result.attempts.some(
      ({ case: name, reason }) =>
        name === "diagnostic-chat" && reason === "invalid-response",
    ),
  );
  assert.throws(
    () => validateConnectionReply("not a diagnostic reply"),
    /invalid-response/,
  );
  let wasAborted = false;
  const stalled = calibrationClient(
    "fixture-deadline",
    async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const watchdog = setTimeout(
          () => reject(new Error("Fixture abort did not fire")),
          3000,
        );
        init?.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(watchdog);
            wasAborted = true;
            reject(init.signal!.reason);
          },
          { once: true },
        );
      }),
  );
  const withDeadline = await stalled.chat(
    "check",
    connectionChat,
    { ...caseOptions, timeoutMs: 1000 },
    { validateText: validateConnectionReply },
  );
  assert.equal(withDeadline.failure?.reason, "timeout");
  assert(wasAborted);
  const noByokCap = await run({ cap: false });
  assert.match(noByokCap.result.error ?? "", /BYOK included/);
  assert.equal(noByokCap.requests.length, 0);
  const capped = await run({}, { maxRequests: 7 });
  assert.match(capped.result.error ?? "", /approved paid request/);
  assert.equal(capped.result.attempts.length, 7);
  assert.equal(capped.result.candidates[0].screening.length, 7);
  assert(
    capped.snapshots.some(
      ({ attempts, state }) => attempts === 4 && state === "incomplete",
    ),
  );
  const titleInterrupted = await run({}, { maxRequests: 41 });
  assert.equal(titleInterrupted.result.status, "incomplete");
  assert.equal(titleInterrupted.result.attempts.length, 41);
  const [observedTitle] = titleInterrupted.result.candidates[0].titles;
  assert(
    observedTitle.heading && !observedTitle.screened && !observedTitle.passed,
  );
  assert.throws(
    () =>
      assertIndependentFamilies(fixtures.selection, [fixtures.selection[0]]),
    /overlaps/,
  );
  // An additional tiny independent SQL run confirms that the production vector
  // arithmetic is available even when paid measurement is never invoked.
  assert.equal(
    (
      await measureSearchDistances([
        {
          id: "orthogonal",
          expected: "unrelated",
          query: Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)),
          document: Array.from({ length: 768 }, (_, i) => (i === 1 ? 1 : 0)),
        },
      ])
    )[0].distance,
    1,
  );
  return {
    measuredComparisons: 2,
    privateHeadings: 40,
    checkpointed: 7,
    embeddingCalls: 61,
    calibrationParity: true,
  };
}

async function observerContracts() {
  const decoded = outboundDestinations([
    'sendto(4, ""..., 1, 0, {sa_family=AF_INET, sin_port=htons(38991), sin_addr=inet_addr("127.0.0.1")}, 16) = 1\n' +
      "sendmsg(4, {msg_name=NULL, msg_namelen=0, msg_iov=[], msg_iovlen=0}, 0) = 0\n" +
      'sendmsg(4, {msg_name={sa_family=AF_INET6, sin6_port=htons(38991), inet_pton(AF_INET6, "::1", &sin6_addr)}, msg_namelen=28}, 0) = 1\n' +
      'sendmmsg(4, [{msg_hdr={msg_name={sa_family=AF_INET, sin_port=htons(38991), sin_addr=inet_addr("127.0.0.1")}, msg_namelen=16}}], 1, 0) = 1\n' +
      "sendmsg(4, {msg_name=0x1, msg_namelen=16}, 0) = -1\n" +
      "sendto(4, <unfinished ...>\n",
  ]);
  assert.deepEqual(
    decoded.endpoints.map(({ call }) => call),
    ["sendto", "sendmsg", "sendmmsg"],
  );
  assert.equal(decoded.undecoded, 2);
  const cleaned: string[] = [];
  await assert.rejects(
    cleanupNetworkFixture([
      [
        [
          "container",
          async () => {
            throw new Error("Docker unavailable");
          },
        ],
      ],
      [
        [
          "network",
          async () => {
            cleaned.push("network");
          },
        ],
      ],
    ]),
    /container/,
  );
  assert.deepEqual(cleaned, ["network"]);
  return { closedRecords: true, cleanupFailuresReported: true };
}

export async function verifyP12ReviewContracts() {
  return {
    chat: await chatContracts(),
    calibration: await calibrationContracts(),
    observer: await observerContracts(),
  };
}

if (process.argv.includes("--standalone"))
  void verifyP12ReviewContracts()
    .then((evidence) => console.log(JSON.stringify(evidence)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
