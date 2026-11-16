import "server-only";
import { runtimeState } from "../runtime-state";
import { log, sqlstate } from "../log";
import { acquireLease, type OwnedLease } from "./leases";
import {
  backfillBatch,
  probeIndex,
  retryDelay,
  usableIndex,
} from "../llm/embeddings";
import { indexSnapshot, type IndexSnapshot } from "../llm/search-index";
import {
  beginCheck,
  completeCreditWait,
  pendingCreditCheck,
  unhealthyCapabilities,
} from "../llm/settings-store";
import { callChat, callEmbeddings, readProviderMetadata } from "../llm/client";
import { AiError } from "../llm/errors";
import { deadline } from "../llm/deadline";

export async function maintenanceDiagnostics(
  index: IndexSnapshot,
  owner: OwnedLease,
) {
  const config = index.config;
  if (
    !config.valid ||
    config.diverged ||
    !config.apiKey ||
    config.enabled === false
  )
    return;
  const { signal, lease } = owner;
  if (!config.configured) {
    const wait = await pendingCreditCheck(config, signal);
    if (!wait?.creditWaitUntil || !config.keyDigest) return;
    const check = await beginCheck(
      config,
      undefined,
      deadline(config.options.timeoutMs, signal),
    );
    const key = await readProviderMetadata(
      "key",
      undefined,
      signal,
      check,
      lease,
    );
    if (
      Array.isArray(key) ||
      key.management ||
      key.expired ||
      key.remaining === 0
    )
      return;
    // Successful paid-model dispatch is the credit evidence, independently of the embedding model.
    await callChat(
      "check",
      { system: "Reply with OK.", text: "Connection check" },
      { check, signal, lease },
    );
    await completeCreditWait(
      check,
      config.keyDigest,
      wait.creditWaitUntil,
      { key: "valid", chat: "passed", search: "untested" },
      lease,
    );
    return;
  }
  const unhealthy = await unhealthyCapabilities(config, signal);
  for (const { capability } of unhealthy) {
    if (capability === "chat")
      await callChat(
        "check",
        { system: "Reply with OK.", text: "Connection check" },
        { lease, signal },
      );
    else if (capability === "embeddings" && !index.reason && index.fingerprint)
      await callEmbeddings("probe", ["Search health check"], {
        lease,
        signal,
        content: { config, wall: deadline(config.options.timeoutMs, signal) },
      });
  }
}
export function startMaintenance() {
  const state = runtimeState();
  if (state.aiMaintenance) return;
  const stop = new AbortController();
  let owner: OwnedLease | null = null,
    localTimer: ReturnType<typeof setTimeout>,
    workTimer: ReturnType<typeof setTimeout>;
  let localWork: Promise<void> | undefined,
    leaderWork: Promise<void> | undefined;
  let token = "",
    diagnosticsDue = 0,
    batchDue = 0,
    failures = 0;
  async function local() {
    try {
      const index = await indexSnapshot(true, stop.signal);
      // Each replica probes independently. A slow request does not delay epoch polling or leadership.
      void probeIndex(index, stop.signal).catch(() => {});
    } catch (error) {
      if (!stop.signal.aborted)
        log("ai.index-refresh-failed", { sqlstate: sqlstate(error) }, "warn");
    } finally {
      if (!stop.signal.aborted) armLocal();
    }
  }
  async function work() {
    try {
      if (owner?.signal.aborted) {
        await owner.release();
        owner = null;
      }
      owner ??= await acquireLease("ai-maintenance");
      if (!owner || stop.signal.aborted) return;
      const index = await indexSnapshot(false, owner.signal);
      if (token !== index.config.token) {
        token = index.config.token;
        diagnosticsDue = 0;
        batchDue = 0;
        failures = 0;
      }
      if (performance.now() >= diagnosticsDue) {
        diagnosticsDue = performance.now() + 300000;
        try {
          await maintenanceDiagnostics(index, owner);
        } catch (error) {
          log(
            "ai.maintenance-diagnostic",
            { stage: error instanceof AiError ? error.reason : "unavailable" },
            "warn",
          );
        }
      }
      if (usableIndex(index) && performance.now() >= batchDue) {
        try {
          await backfillBatch(index, owner.lease, owner.signal);
          failures = 0;
        } catch (error) {
          batchDue = performance.now() + retryDelay(++failures);
          throw error;
        }
      }
    } catch (error) {
      if (!stop.signal.aborted)
        log(
          "ai.maintenance-deferred",
          { stage: error instanceof AiError ? error.reason : "unavailable" },
          "warn",
        );
    } finally {
      if (!stop.signal.aborted) armWork();
    }
  }
  function armLocal() {
    localTimer = setTimeout(() => {
      localWork = local();
    }, 5000);
    localTimer.unref();
  }
  function armWork() {
    workTimer = setTimeout(() => {
      leaderWork = work();
    }, 5000);
    workTimer.unref();
  }
  const shutdown = async () => {
    stop.abort();
    clearTimeout(localTimer);
    clearTimeout(workTimer);
    if (owner) await owner.release().catch(() => {});
    await Promise.allSettled([localWork, leaderWork]);
    if (owner && !owner.signal.aborted) await owner.release().catch(() => {});
    process.off("SIGTERM", onSignal);
    process.off("SIGINT", onSignal);
    delete state.aiMaintenance;
  };
  const onSignal = () => {
    void shutdown();
  };
  state.aiMaintenance = { stop: shutdown };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
  armLocal();
  armWork();
}
