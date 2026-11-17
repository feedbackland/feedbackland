import assert from "node:assert/strict";
import { sql } from "kysely";
import { db } from "../../db/db";
import { eventually } from "./run";
import { admin, setBudget } from "./insight-test-support";
import { fixtureKey, type onboardingProvider } from "./onboarding-provider";
import {
  adminAiState,
  configuration,
  dismissAiNotice,
  recordModelVision,
  saveConfiguration,
  undoKey,
} from "../../lib/llm/settings-store";
import {
  checkConnection,
  installKey,
  updateAiOptions,
} from "../../lib/llm/onboarding";
import { finishConnect, startConnect } from "../../lib/llm/connect";
import { deadline } from "../../lib/llm/deadline";
import { canImproveDraft } from "../../lib/llm/content-capabilities";
import { improveDraft, screenContent } from "../../lib/llm/content";
import { readProviderMetadata } from "../../lib/llm/client";
import { indexSnapshot, rebuildIndex } from "../../lib/llm/search-index";
import {
  backfillBatch,
  embeddingsAvailable,
  probeIndex,
} from "../../lib/llm/embeddings";
import { acquireLease } from "../../lib/jobs/leases";
import { maintenanceDiagnostics } from "../../lib/jobs/maintenance";
import { backfillControl, maxVisionImages } from "../../lib/ai-request-limits";
import { largeRequestScenarios } from "../../lib/ai-cost-scenarios";
import { recordRequest, systemStatus } from "../../lib/request-diagnostics";
import { runtimeState } from "../../lib/runtime-state";
import { json } from "../mock-llm";

export async function onboardingRegressions({
  mock,
  state,
  issue,
}: Awaited<ReturnType<typeof onboardingProvider>>) {
  const peer = { userId: "insight-voter", sessionId: "insight-voter" };
  const status = () => adminAiState(admin);
  const identity = async () => (await status()).identity;
  const config = () => configuration(undefined, true);
  const reset = async () => {
    await db
      .deleteFrom("rate_limit")
      .where((eb) =>
        eb.or([
          eb("key", "like", "ai-check:user:%"),
          eb("key", "like", "ai:credit-poll:%"),
          eb("key", "=", "ai:metadata:minute"),
        ]),
      )
      .execute();
    await setBudget(0);
  };
  const install = async (mode: string) => {
    await reset();
    state.mode = mode;
    return installKey(admin, await identity(), fixtureKey);
  };
  const check = async (mode: string) => {
    state.mode = mode;
    return checkConnection(admin, await identity(), "test-again");
  };
  await updateAiOptions(admin, await identity(), { dailyCallLimit: 5000 });
  await install("credit");
  state.mode = "paid";
  await checkConnection(peer, await identity(), "enable");
  assert.equal((await status()).undo, false);
  const afterPeer = await identity();
  await assert.rejects(undoKey(admin, afterPeer), /STALE_CONFIGURATION/);
  assert.equal((await status()).state, "on");
  await install("credit");
  state.mode = "paid";
  await checkConnection(peer, await identity(), "credit");
  assert((await status()).undo);
  await undoKey(admin, await identity());
  assert.equal((await status()).state, "on");

  const working = await status(),
    beforeRequests = mock.requests;
  await sql`update rate_limit set count=10 where key=${"ai-check:user:" + admin.userId}`.execute(
    db,
  );
  await assert.rejects(
    installKey(admin, working.identity, fixtureKey + "2222"),
    /provider-rate/,
  );
  await assert.rejects(
    installKey(
      admin,
      working.identity,
      fixtureKey + "2222",
      AbortSignal.abort(),
    ),
  );
  assert.deepEqual((await status()).identity, working.identity);
  assert.equal((await status()).last4, working.last4);
  assert.equal((await status()).state, "on");
  assert.equal(mock.requests, beforeRequests);
  await reset();
  const cancel = new AbortController(),
    held = Promise.withResolvers<void>(),
    startReads = state.keyReads;
  const replacement = fixtureKey + "2222";
  mock.expectedKey = replacement;
  state.keyGate = held.promise;
  const interrupted = installKey(
    admin,
    working.identity,
    replacement,
    cancel.signal,
  );
  try {
    await eventually(
      async () => state.keyReads,
      (n) => n > startReads,
      3000,
    );
    assert.equal((await status()).last4, working.last4);
    assert.equal(await canImproveDraft(), true);
    cancel.abort();
    await assert.rejects(interrupted);
  } finally {
    held.resolve();
    state.keyGate = undefined;
    mock.expectedKey = fixtureKey;
  }
  assert.deepEqual((await status()).identity, working.identity);
  assert.equal((await status()).state, "on");

  await setBudget((await status()).options.dailyCallLimit);
  await assert.rejects(
    installKey(admin, working.identity, fixtureKey),
    /current key is still active/,
  );
  assert.deepEqual((await status()).identity, working.identity);
  await reset();
  for (const mode of ["malformed", "vision", "width"]) {
    await install("credit");
    const lease = await acquireLease("ai-maintenance");
    assert(lease);
    try {
      state.mode = mode;
      await maintenanceDiagnostics(await indexSnapshot(false), lease);
      const worker = await status();
      const manual = await checkConnection(
        admin,
        await identity(),
        "test-again",
      );
      assert.equal(worker.check?.chat, manual.check.chat, mode);
      assert.equal(worker.check?.search, manual.check.search, mode);
      assert.equal(worker.check?.chatIssue, manual.check.chatIssue);
      assert.equal(worker.enabled, mode === "width" ? true : null);
      assert(
        state.samples
          .filter((s) => s.kind === "check")
          .slice(-2)
          .every((s) => s.images === 1),
      );
    } finally {
      await lease.release();
    }
  }

  await install("paid");
  await check("invalid");
  await dismissAiNotice(admin, "failure");
  const incident = (await status()).check!.incidentSince;
  state.mode = "invalid";
  await checkConnection(peer, await identity(), "test-again");
  assert.equal((await status()).check?.incidentSince, incident);
  assert((await status()).hideFailure);
  const beforeEdit = mock.requests;
  await updateAiOptions(admin, await identity(), { dailyCallLimit: 5500 });
  assert.equal(mock.requests, beforeEdit);
  assert.equal((await status()).reason, "invalid-key");
  assert.equal(await canImproveDraft(), false);
  await check("paid");
  await check("invalid");
  assert.equal((await status()).hideFailure, false);

  await install("credit");
  const oldWait = await status();
  await updateAiOptions(admin, oldWait.identity, { timeoutMs: 16000 });
  const edited = await config();
  await recordModelVision(
    edited,
    [{ id: edited.options.model, vision: !edited.options.vision }],
    deadline(4000),
  );
  const waiting = await status();
  assert.notEqual(edited.token, waiting.identity.token);
  assert.equal(waiting.state, "credit");
  assert.deepEqual(waiting.creditWaitUntil, oldWait.creditWaitUntil);
  await assert.rejects(
    checkConnection(admin, oldWait.identity, "credit"),
    /STALE_CONFIGURATION/,
  );
  state.mode = "paid";
  await checkConnection(admin, waiting.identity, "credit");
  assert.equal((await status()).state, "on");
  await updateAiOptions(admin, await identity(), { vision: true });

  const original = await status();
  await install("paid");
  const index = await indexSnapshot(false);
  const rebuilt = await rebuildIndex(peer, {
    token: index.config.token,
    epoch: index.epoch,
    dimensions: 512,
  });
  assert.equal(rebuilt.dimensions, 512);
  await undoKey(admin, await identity());
  const restored = await status();
  assert.equal(restored.check?.at, original.check?.at);
  assert.equal(restored.check?.search, "untested");
  assert.equal(restored.check?.verifiedDimensions, undefined);

  await reset();
  state.expiry = new Date(Date.now() + 1800).toISOString();
  await check("paid");
  assert((await status()).chatAvailable);
  await new Promise((r) =>
    setTimeout(r, Math.max(0, Date.parse(state.expiry!) - Date.now() + 30)),
  );
  assert.equal((await status()).reason, "expired-key");
  assert.equal(await canImproveDraft(), false);
  assert.equal(await embeddingsAvailable(), false);
  state.expiry = null;
  await check("paid");
  await check("rate");
  assert.equal(await canImproveDraft(), false);
  state.mode = "paid";
  await improveDraft("An unpublished fixture draft");
  assert.equal((await status()).chatAvailable, true);
  assert.equal(await canImproveDraft(), true);
  await check("width");
  assert.equal(await embeddingsAvailable(), false);
  state.mode = "paid";
  await probeIndex(await indexSnapshot(false));
  assert.equal(await embeddingsAvailable(), true);
  await updateAiOptions(admin, await identity(), {
    embeddingModel: "openai/text-embedding-3-large",
  });
  assert.equal((await status()).rebuildRequired, true);
  assert.equal((await status()).check?.search, "passed");
  assert.equal(await embeddingsAvailable(), false);
  await updateAiOptions(admin, await identity(), {
    embeddingModel: "openai/text-embedding-3-small",
  });

  for (const mode of ["invalid", "management", "expired", "limit"]) {
    await install("credit");
    state.mode = mode;
    await checkConnection(admin, await identity(), "credit");
    assert.equal((await status()).state, "attention", mode);
    assert.equal((await status()).creditWaitUntil, null);
    const lease = await acquireLease("ai-maintenance");
    assert(lease);
    try {
      const sent = mock.requests;
      await maintenanceDiagnostics(await indexSnapshot(false), lease);
      assert.equal(mock.requests, sent);
    } finally {
      await lease.release();
    }
  }
  await install("credit");
  state.mode = "paid";
  const gate = Promise.withResolvers<void>(),
    reads = state.keyReads,
    chats = state.chat,
    embeds = state.embeddings;
  state.keyGate = gate.promise;
  const pending = checkConnection(admin, await identity(), "credit");
  try {
    await eventually(
      async () => state.keyReads,
      (n) => n > reads,
      3000,
    );
    await sql`update ai_settings set "creditWaitUntil"=clock_timestamp()-interval '1 millisecond'`.execute(
      db,
    );
  } finally {
    gate.resolve();
    state.keyGate = undefined;
  }
  await assert.rejects(pending, /AI_NOT_CONFIGURED|STALE_CONFIGURATION/);
  assert.equal(state.chat, chats);
  assert.equal(state.embeddings, embeds);
  await check("paid");
  await saveConfiguration(admin, await identity(), { enabled: false });
  const offRequests = mock.requests;
  for (const kind of ["chatModels", "embeddingModels"] as const)
    await assert.rejects(
      readProviderMetadata(kind, admin),
      /AI_NOT_CONFIGURED/,
    );
  assert.equal(mock.requests, offRequests);

  // Two independent browser cookie receipts, with the failed older completion delivered last.
  await reset();
  const origin = "https://board.test";
  const channel = (cookie = "") => ({
    headers: new Headers({
      origin,
      host: "board.test",
      "x-forwarded-proto": "https",
      cookie,
    }),
    responseHeaders: new Headers(),
  });
  const a = channel(),
    b = channel(),
    id = await identity();
  const first = await startConnect(admin, id, true, a),
    second = await startConnect(admin, id, true, b);
  const ca = a.responseHeaders.getSetCookie()[0].split(";")[0],
    cb = b.responseHeaders.getSetCookie()[0].split(";")[0];
  const failed = channel(ca + "; " + cb);
  await assert.rejects(
    finishConnect(
      admin,
      { mode: "headless", nonce: first.nonce, code: "unused" },
      failed,
    ),
    /could not complete/,
  );
  assert.equal(
    failed.responseHeaders.getSetCookie()[0].split("=")[0],
    ca.split("=")[0],
  );
  assert.notEqual(ca.split("=")[0], cb.split("=")[0]);
  const completed = {
    mode: "headless" as const,
    nonce: second.nonce,
    code: issue(new URL(second.url).searchParams.get("code_challenge")!),
  };
  assert.equal(
    (await finishConnect(admin, completed, channel(cb))).repeated,
    false,
  );
  assert.equal(
    (await finishConnect(admin, completed, channel(cb))).repeated,
    true,
  );

  state.limitReset = null;
  await check("paid");
  assert.equal((await status()).check?.limitReset, null);
  state.limitReset = "monthly";
  state.balance = 7;
  await check("paid");
  assert.equal((await status()).check?.limitReset, "monthly");
  assert.equal((await status()).check?.remaining, 7);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGNsaGhgwAaYsIoOWgkAMBcBkGHHl6YAAAAASUVORK5CYII=",
    "base64",
  );
  const images = await db
    .insertInto("images")
    .values(
      Array.from({ length: maxVisionImages }, () => ({
        bytes: png,
        byteSize: png.length,
        width: 8,
        height: 8,
        contentType: "image/png",
      })),
    )
    .returning(["id", "byteSize", "width", "height", "contentType"])
    .execute();
  state.mode = "vision";
  const sample = state.samples.length;
  const moderation = await screenContent(
    "Four image submission",
    images,
    false,
  );
  assert.equal(moderation.coverage.state, "screened-text");
  assert.deepEqual(
    state.samples.slice(sample).map((s) => [s.kind, s.images]),
    [
      ["moderation", 4],
      ["moderation", 0],
    ],
  );
  state.mode = "paid";
  await improveDraft("Only send this when the visitor asks");
  assert.equal(state.samples.at(-1)?.kind, "rewrite");
  const cfg = await config(),
    prices = [
      {
        id: cfg.options.embeddingModel,
        inputPrice: "0.000001",
        requestPrice: "0.001",
        outputPrice: null,
      },
    ];
  const scenarios = largeRequestScenarios(
    cfg.options.model,
    cfg.options.embeddingModel,
    prices,
    cfg.dimensions,
  );
  assert(
    scenarios.some(
      (r) =>
        r.feature.includes("text-only fallback") &&
        r.shape.includes("2 attempts"),
    ),
  );
  const split = scenarios.find((r) => r.feature.includes("split retries"))!;
  const normal = scenarios.find((r) => r.feature === "Backfill batch")!;
  assert(split.cost! > normal.cost!);
  assert.equal(
    largeRequestScenarios("fixture", cfg.options.embeddingModel, [
      { ...prices[0], requestPrice: null },
    ]).find((r) => r.feature === normal.feature)?.cost,
    null,
  );
  await db
    .insertInto("feedback")
    .values(
      ["one", "two"].map((text) => ({
        title: text,
        description: text,
        plainText: text,
        moderationState: "disabled",
      })),
    )
    .execute();
  const active = await indexSnapshot(true);
  await probeIndex(active);
  const handler = mock.handler,
    calls: string[][] = [];
  mock.handler = (wire) => {
    if (wire.url.endsWith("/embeddings")) {
      const input = wire.body.input as string[];
      calls.push(input);
      if (!input.includes(backfillControl)) return json(wire.response, {}, 400);
    }
    return handler(wire);
  };
  const lease = await acquireLease("ai-maintenance");
  assert(lease);
  try {
    assert.equal(await backfillBatch(active, lease.lease, lease.signal), 2);
  } finally {
    mock.handler = handler;
    await lease.release();
  }
  assert.equal(calls.filter((v) => v.includes(backfillControl)).length, 3);
  assert.equal(calls.length, 8);

  for (const [base, hosts] of [
    ["https://board.test", ["board.test:443", "BOARD.TEST", "board.test:80"]],
    ["http://board.test", ["board.test:80", "board.test", "board.test:443"]],
    ["https://[::1]", ["[::1]:443", "[::1]", "[::1]:444"]],
  ] as const) {
    runtimeState().requestSamples = [];
    for (const host of hosts) recordRequest(new Headers({ host }));
    const headers = new Headers({
      host: new URL(base).host,
      "x-forwarded-proto": new URL(base).protocol.slice(0, -1),
    });
    assert.equal(systemStatus(headers).mismatchedHost, 1, base);
  }
  await reset();
}
