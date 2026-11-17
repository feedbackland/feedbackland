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
  pendingCreditCheck,
  unhealthyCapabilities,
} from "../llm/settings-store";
import { AiError } from "../llm/errors";
import { runConnectionCheck } from "../llm/onboarding";
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
      lease,
    );
    await runConnectionCheck(config, check, { signal, worker: owner });
    return;
  }
  const unhealthy = await unhealthyCapabilities(config, signal);
  if (!unhealthy.length) return;
  const check = await beginCheck(
    config,
    undefined,
    deadline(config.options.timeoutMs, signal),
    lease,
  );
  await runConnectionCheck(config, check, {
    signal,
    worker: owner,
    capabilities: {
      chat: unhealthy.some((h) => h.capability === "chat"),
      search:
        !index.reason &&
        !!index.fingerprint &&
        unhealthy.some((h) => h.capability === "embeddings"),
    },
  });
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
      if (owner && (index.config.diverged || !index.config.valid)) {
        const invalid = owner;
        owner = null;
        await invalid.release();
      }
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
      const index = await indexSnapshot(false, stop.signal);
      if (index.config.diverged || !index.config.valid) {
        if (owner) {
          const invalid = owner;
          owner = null;
          await invalid.release();
        }
        return;
      }
      owner ??= await acquireLease("ai-maintenance");
      if (!owner || stop.signal.aborted) return;
      const currentOwner = owner;
      if (token !== index.config.token) {
        token = index.config.token;
        diagnosticsDue = 0;
        batchDue = 0;
        failures = 0;
      }
      if (performance.now() >= diagnosticsDue) {
        diagnosticsDue = performance.now() + 300000;
        try {
          await maintenanceDiagnostics(index, currentOwner);
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
          await backfillBatch(index, currentOwner.lease, currentOwner.signal);
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
