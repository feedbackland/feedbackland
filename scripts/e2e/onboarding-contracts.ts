import assert from "node:assert/strict";
import { sql } from "kysely";
import { eventually } from "./run";
import { db } from "../../db/db";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { acquireLease } from "../../lib/jobs/leases";
import { maintenanceDiagnostics } from "../../lib/jobs/maintenance";
import {
  adminAiState,
  beginCheck,
  configuration,
  dismissAiNotice,
  finishAdminCheck,
  saveConfiguration,
  undoKey,
} from "../../lib/llm/settings-store";
import {
  checkConnection,
  installKey,
  updateAiOptions,
  diagnosticIssue,
} from "../../lib/llm/onboarding";
import { indexSnapshot } from "../../lib/llm/search-index";
import { embeddingsAvailable } from "../../lib/llm/embeddings";
import { AiError } from "../../lib/llm/errors";
import { finishConnect, startConnect } from "../../lib/llm/connect";
import { adminUsage } from "../../lib/llm/admin-usage";
import { keyProblem } from "../../lib/ai-onboarding-copy";
import { largeRequestScenarios } from "../../lib/ai-cost-scenarios";
import { recordRequest, systemStatus } from "../../lib/request-diagnostics";
import { fixtureKey, onboardingProvider } from "./onboarding-provider";
import { admin, setup, setBudget } from "./insight-test-support";
import { privateMarker } from "../mock-llm";

async function main() {
  const initial = await migrateAndSeed();
  runtimeState().authSecret = initial.authSecret;
  runtimeState().vector = initial.metadata;
  const { mock, state, issue } = await onboardingProvider();
  const second = { userId: "insight-voter", sessionId: "insight-voter" };
  const status = () => adminAiState(admin);
  const current = async () => (await status()).identity;
  const resetUserWindow = () =>
    db
      .deleteFrom("rate_limit")
      .where("key", "like", "ai-check:user:%")
      .execute();
  const channel = (origin: string, cookie?: string) => ({
    headers: new Headers({
      origin,
      host: new URL(origin).host,
      "x-forwarded-proto": new URL(origin).protocol.slice(0, -1),
      ...(cookie ? { cookie } : {}),
    }),
    responseHeaders: new Headers(),
  });
  const origin = "https://board.test";
  try {
    await setup();
    await db
      .updateTable("user")
      .where("id", "=", second.userId)
      .set({ role: "admin" })
      .execute();
    await db.updateTable("settings").set({ allowIndexing: true }).execute();
    const original = await current();
    const flow = channel(origin),
      start = await startConnect(admin, original, false, flow);
    assert.equal(start.mode, "redirect");
    const url = new URL(start.url),
      nonce = start.nonce;
    const cookie = flow.responseHeaders.getSetCookie()[0].split(";")[0];
    assert.match(cookie, /=v1\./);
    assert.match(
      flow.responseHeaders.getSetCookie()[0],
      /HttpOnly; SameSite=Lax; Secure/,
    );
    assert.equal(url.searchParams.get("state"), nonce);
    assert.equal(
      url.searchParams.get("callback_url"),
      origin + "/admin/settings/ai/return/" + nonce,
    );
    assert(!url.searchParams.has("code_verifier"));
    const code = issue(url.searchParams.get("code_challenge")!);
    const finish = { mode: "redirect" as const, code, state: nonce, nonce };
    for (const invalid of [
      () =>
        finishConnect(
          admin,
          { ...finish, state: "0".repeat(32) },
          channel(origin, cookie),
        ),
      () =>
        finishConnect(
          admin,
          { ...finish, nonce: "0".repeat(32) },
          channel(origin, cookie),
        ),
      () => finishConnect(admin, finish, channel(origin)),
      () => finishConnect(second, finish, channel(origin, cookie)),
      () =>
        finishConnect(admin, finish, channel("https://another.test", cookie)),
      () =>
        finishConnect(
          admin,
          { mode: "headless", nonce, code },
          channel(origin, cookie),
        ),
    ])
      await assert.rejects(invalid, /timed out/);
    assert.equal(state.exchanges, 0);
    const finishes = await Promise.all([
      finishConnect(admin, finish, channel(origin, cookie)),
      finishConnect(admin, finish, channel(origin, cookie)),
    ]);
    assert.deepEqual(finishes.map((f) => f.repeated).sort(), [false, true]);
    assert.equal(state.exchanges, 1);
    assert.equal((await status()).state, "on");
    assert.equal(await embeddingsAvailable(), true);
    const saved = await status();
    assert.equal(saved.check?.search, "passed");
    assert.equal(saved.last4, "1111");
    assert(!JSON.stringify(saved).includes(fixtureKey));
    const row = await db
      .selectFrom("ai_settings")
      .select(["apiKey", "keyUndo"])
      .executeTakeFirstOrThrow();
    assert.match(row.apiKey!, /^v1\./);
    assert(!JSON.stringify(row).includes(fixtureKey));
    await undoKey(admin, saved.identity);
    assert.equal((await status()).state, "off");
    for (const [value, reason] of [
      ["sk-proj-example", "OpenAI"],
      ["sk-ant-example", "Anthropic"],
      ["AIzaexample", "Google"],
    ])
      assert(keyProblem(value)?.includes(reason));
    await dismissAiNotice(admin, "off");
    assert((await status()).hideActivity);
    assert(!(await adminAiState(second)).hideActivity);
    for (const [address, unlisted] of [
      ["http://192.0.2.3", false],
      [origin, true],
    ] as const) {
      const ch = channel(address),
        flow = await startConnect(admin, await current(), unlisted, ch),
        auth = new URL(flow.url);
      assert.equal(flow.mode, "headless");
      assert(!auth.searchParams.has("state"));
      assert(!auth.searchParams.has("callback_url"));
      assert(!auth.href.includes(new URL(address).host));
    }
    await resetUserWindow();
    const racing = channel(origin);
    const pending = await startConnect(admin, await current(), false, racing);
    const purl = new URL(pending.url),
      gate = Promise.withResolvers<void>();
    state.exchangeGate = gate.promise;
    const started = finishConnect(
      admin,
      {
        mode: "redirect",
        nonce: pending.nonce,
        state: pending.nonce,
        code: issue(purl.searchParams.get("code_challenge")!),
      },
      channel(origin, racing.responseHeaders.getSetCookie()[0].split(";")[0]),
    );
    try {
      await eventually(
        async () => state.exchanges,
        (n) => n === 2,
        3000,
      );
      await saveConfiguration(second, await current(), { enabled: false });
    } finally {
      gate.resolve();
      state.exchangeGate = undefined;
    }
    await assert.rejects(started, /STALE_CONFIGURATION/);
    assert.equal((await status()).enabled, false);
    const waitFor = async (mode: string) => {
      state.mode = mode;
      return installKey(admin, await current(), fixtureKey);
    };
    await waitFor("credit");
    assert.equal((await status()).state, "credit");
    assert.equal((await status()).check?.chatIssue, "account-credit");
    assert(
      (await status()).creditWaitUntil!.getTime() > Date.now() + 6 * 86400000,
    );
    await checkConnection(admin, await current(), "credit");
    const currentWait = await current();
    await assert.rejects(
      () => checkConnection(second, currentWait, "credit"),
      /AI_BUSY/,
    );
    await db
      .deleteFrom("rate_limit")
      .where("key", "like", "ai:credit-poll:%")
      .execute();
    const ordinaryChat = state.chat;
    await setBudget(5000);
    const owner = await acquireLease("ai-maintenance");
    assert(owner);
    try {
      await maintenanceDiagnostics(await indexSnapshot(false), owner).catch(
        (e) => {
          assert(e instanceof AiError && e.reason === "AI_PAUSED");
        },
      );
      assert.equal(state.chat, ordinaryChat);
      assert.equal((await status()).budget.diagnostic, 0);
      await setBudget(0);
      await db
        .deleteFrom("rate_limit")
        .where("key", "like", "ai:credit-poll:%")
        .execute();
      state.mode = "paid";
      await maintenanceDiagnostics(await indexSnapshot(false), owner);
      assert.equal((await status()).state, "on");
    } finally {
      await owner.release();
    }
    await resetUserWindow();
    for (const [mode, expected] of [
      ["invalid", "invalid-key"],
      ["management", "management-key"],
      ["expired", "expired-key"],
      ["limit", "key-limit"],
      ["unknown-model", "model-unavailable"],
      ["malformed", "invalid-response"],
      ["rate", "provider-rate"],
      ["width", "dimension-mismatch"],
    ]) {
      await waitFor(mode);
      const result = await status();
      assert.equal(result.reason, expected, mode);
      assert(!JSON.stringify(result).includes(privateMarker));
      assert.equal(result.state, "attention");
      if (mode === "width") {
        assert.equal(result.check?.actualDimensions, 2);
        assert.equal(result.chatAvailable, true);
      }
    }
    await resetUserWindow();
    state.mode = "paid";
    await waitFor("paid");
    const a = await configuration(undefined, true);
    const held = await beginCheck(a, { actor: admin, intent: "configure" });
    const newer = await saveConfiguration(second, a, { enabled: false });
    await assert.rejects(
      () =>
        finishAdminCheck(
          held,
          { key: "valid", chat: "passed", search: "passed" },
          true,
        ),
      /STALE_CONFIGURATION/,
    );
    await assert.rejects(() => undoKey(admin, newer), /STALE_CONFIGURATION/);
    assert.equal((await status()).enabled, false);
    await checkConnection(admin, newer, "enable");
    const newId = await current(),
      beforeCalls = state.chat + state.embeddings;
    await updateAiOptions(admin, newId, { dailyCallLimit: 10 });
    assert.equal(state.chat + state.embeddings, beforeCalls);
    await assert.rejects(
      () => updateAiOptions(second, newId, { dailyCallLimit: 12 }),
      /STALE_CONFIGURATION/,
    );
    await setBudget(10);
    const paused = await status();
    assert.equal(paused.state, "paused");
    assert.equal(await embeddingsAvailable(), false);
    await checkConnection(admin, paused.identity, "test-again");
    const after = await status();
    assert(after.budget.diagnostic > 0);
    assert.equal(after.budget.used, 10);
    await setBudget(0);
    assert.notEqual((await status()).statusVersion, paused.statusVersion);
    assert((await adminUsage(admin)).usage.some((r) => r.feature === "check"));
    for (const [e, r] of [
      [new AiError("timeout"), "timeout"],
      [new AiError("provider-error"), "network"],
      [new AiError("data-policy"), "privacy"],
      [
        new AiError(
          "provider-credit",
          402,
          undefined,
          "request-exceeds-balance",
        ),
        "request-exceeds-balance",
      ],
    ] as const)
      assert.equal(diagnosticIssue(e), r);
    await resetUserWindow();
    await setBudget(0);
    await waitFor("credit");
    await db
      .updateTable("ai_settings")
      .set({ creditWaitUntil: sql`clock_timestamp()-interval '1 second'` })
      .execute();
    assert.equal((await status()).state, "expired");
    const expired = await current();
    await assert.rejects(
      () => checkConnection(admin, expired, "credit"),
      /AI_NOT_CONFIGURED/,
    );
    state.mode = "paid";
    await checkConnection(admin, expired, "test-again");
    assert.equal((await status()).state, "on");
    await db
      .updateTable("admin_notice")
      .where("userId", "=", admin.userId)
      .set({ hiddenUntil: new Date(Date.now() - 1000) })
      .execute();
    assert.equal((await status()).hideActivity, false);
    const operational = await configuration(undefined, true);
    await db
      .insertInto("ai_health")
      .values({
        configToken: operational.token,
        capability: "chat",
        failingSince: new Date(),
        lastFailureAt: new Date(),
        lastReason: "provider-rate",
      })
      .onConflict((c) =>
        c
          .columns(["configToken", "capability"])
          .doUpdateSet({
            failingSince: new Date(),
            lastFailureAt: new Date(),
            lastReason: "provider-rate",
          }),
      )
      .execute();
    assert.equal((await status()).chatAvailable, true);
    await db
      .updateTable("ai_health")
      .where("configToken", "=", operational.token)
      .where("capability", "=", "chat")
      .set({ failingSince: sql`clock_timestamp()-interval '16 minutes'` })
      .execute();
    assert.equal((await status()).state, "attention");
    assert.equal((await status()).chatAvailable, false);
    await dismissAiNotice(admin, "failure");
    assert((await status()).hideFailure);
    assert(!(await adminAiState(second)).hideFailure);
    await db
      .updateTable("ai_health")
      .where("configToken", "=", operational.token)
      .set({ failingSince: null, lastSuccessAt: new Date(), lastReason: null })
      .execute();
    assert.equal((await status()).state, "on");
    const env = await configuration(undefined, true);
    process.env.OPENROUTER_MODEL = env.options.model;
    process.env.OPENROUTER_API_KEY = fixtureKey;
    try {
      const locked = await status();
      assert(locked.locked.includes("model"));
      assert.equal(locked.keySource, "environment");
      await assert.rejects(
        () =>
          saveConfiguration(admin, locked.identity, {
            options: { model: "a/model" },
          }),
        /invalid-input/,
      );
      await assert.rejects(
        () => saveConfiguration(admin, locked.identity, { apiKey: null }),
        /invalid-input/,
      );
      await saveConfiguration(admin, locked.identity, { enabled: false });
      assert.equal((await status()).state, "off");
    } finally {
      delete process.env.OPENROUTER_MODEL;
      delete process.env.OPENROUTER_API_KEY;
    }
    const prices = largeRequestScenarios(
      "fixture",
      "openai/text-embedding-3-small",
      [
        {
          id: "openai/text-embedding-3-small",
          inputPrice: "0.000001",
          outputPrice: null,
        },
      ],
    );
    assert(prices.some((r) => r.cost === null));
    assert(prices.some((r) => r.cost === 0.032));
    const headers = channel(origin).headers;
    for (let i = 0; i < 102; i++)
      recordRequest(
        new Headers({
          host: i < 7 ? "other.test" : "board.test",
          ...(i % 2 ? { "x-forwarded-for": "192.0.2.1" } : {}),
        }),
      );
    assert.equal(systemStatus(headers).requests, 100);
    assert.equal(systemStatus(headers).missingClientIp, 50);
    assert.equal(systemStatus(headers).mismatchedHost, 5);
    console.log("P11 onboarding contracts passed");
  } finally {
    await mock.close();
    await db.destroy();
    await runtimeState().maintenancePool?.end();
  }
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
