import "server-only";
import { setImmediate as yieldTurn } from "node:timers/promises";
import { sql } from "kysely";
import { contentTransaction } from "../../db/content-transaction";
import { runtimeState } from "../runtime-state";
import { log } from "../log";
import type { Lease } from "../jobs/leases";
import { callEmbeddings, embeddingRequestLimit } from "./client";
import { usableCheckedKey } from "./settings-store";
import { deadline } from "./deadline";
import { AiError, EmbeddingWidthError } from "./errors";
import { prepareEmbedding } from "./model-profiles";
import {
  indexSnapshot,
  writeVectors,
  type IndexSnapshot,
  type IndexRow,
} from "./search-index";

const backoff = [5000, 30000, 120000, 600000];
export const retryDelay = (failures: number) =>
  backoff[Math.min(Math.max(0, failures - 1), backoff.length - 1)];
export function probeInfo(index: IndexSnapshot) {
  const probe = runtimeState().embeddingProbe;
  return probe?.identity === index.config.token ? probe : undefined;
}
export function usableIndex(index: IndexSnapshot) {
  return (
    !index.reason &&
    !!index.fingerprint &&
    usableCheckedKey(index.config) &&
    probeInfo(index)?.ready === true
  );
}
export async function embeddingsAvailable() {
  const probe = runtimeState().embeddingProbe;
  if (!probe?.ready) return false;
  try {
    return usableIndex(await indexSnapshot(false, AbortSignal.timeout(1500)));
  } catch {
    return false;
  }
}
export function disableProfile(index: IndexSnapshot, reason: string) {
  if (
    runtimeState().vectorEpoch !== index.epoch ||
    probeInfo(index)?.identity !== index.config.token
  )
    return;
  runtimeState().embeddingProbe = {
    identity: index.config.token,
    ready: false,
    reason,
    attempt: 0,
    next: Infinity,
    checked: probeInfo(index)?.checked,
  };
}
export function recordEmbeddingFailure(index: IndexSnapshot, error: unknown) {
  const probe = probeInfo(index);
  if (!probe || !(error instanceof AiError)) return;
  if (error.reason === "context-length") {
    disableProfile(index, "profile-context-length");
    return;
  }
  if (error instanceof EmbeddingWidthError) {
    probe.expected = error.expected;
    probe.actual = error.actual;
    log(
      "ai.embedding-width",
      { dimensions: error.expected, count: error.actual },
      "warn",
    );
  } else if (
    ![
      "provider-auth",
      "provider-credit",
      "provider-rate",
      "provider-error",
      "timeout",
      "invalid-response",
      "response-too-large",
      "data-policy",
    ].includes(error.reason)
  )
    return;
  if (probe.ready) {
    probe.ready = false;
    probe.reason =
      error instanceof EmbeddingWidthError
        ? "provider-width-mismatch"
        : [
              "provider-error",
              "timeout",
              "invalid-response",
              "response-too-large",
            ].includes(error.reason)
          ? "unverified"
          : error.reason;
    probe.next = performance.now() + retryDelay(++probe.attempt);
  }
}
export async function probeIndex(index: IndexSnapshot, signal?: AbortSignal) {
  if (index.reason || !index.fingerprint || !usableCheckedKey(index.config))
    return;
  const state = runtimeState();
  const probe = probeInfo(index) ?? {
    identity: index.config.token,
    ready: false,
    reason: "unverified",
    attempt: 0,
    next: 0,
  };
  if (probe.pending) return probe.pending;
  if (probe.reason === "profile-context-length") return;
  const passed =
    index.config.check?.search === "passed" ? index.config.check.at : undefined;
  if (passed && probe.checked !== passed) {
    probe.checked = passed;
    probe.next = 0;
  }
  if (probe.ready || probe.next > performance.now()) return;
  state.embeddingProbe = probe;
  probe.pending = (async () => {
    try {
      await callEmbeddings(
        "probe",
        ["Feedbackland search index dimension check"],
        {
          signal,
          content: {
            config: index.config,
            wall: deadline(index.config.options.timeoutMs, signal),
          },
        },
      );
      if (state.embeddingProbe !== probe) return;
      probe.ready = true;
      probe.reason = "verified";
      probe.attempt = 0;
      delete probe.expected;
      delete probe.actual;
    } catch (error) {
      if (state.embeddingProbe !== probe || signal?.aborted) return;
      probe.ready = false;
      probe.reason =
        error instanceof AiError &&
        ![
          "provider-error",
          "timeout",
          "invalid-response",
          "response-too-large",
        ].includes(error.reason)
          ? error.reason
          : "unverified";
      if (error instanceof EmbeddingWidthError) {
        probe.reason = "provider-width-mismatch";
        probe.expected = error.expected;
        probe.actual = error.actual;
        log(
          "ai.embedding-width",
          { dimensions: error.expected, count: error.actual },
          "warn",
        );
      }
      if (error instanceof AiError && error.reason === "context-length") {
        disableProfile(index, "profile-context-length");
      } else {
        probe.next = performance.now() + retryDelay(++probe.attempt);
      }
    } finally {
      delete probe.pending;
    }
  })();
  return probe.pending;
}
export async function embedCommitted(row: IndexRow, signal?: AbortSignal) {
  try {
    // Before the first verified probe, leave the committed revision for backfill.
    if (!runtimeState().embeddingProbe?.ready) return;
    const index = await indexSnapshot(false, signal);
    if (!usableIndex(index)) return;
    try {
      const values = row.text.trim()
        ? await callEmbeddings("embed-write", [row.text], {
            signal,
            content: {
              config: index.config,
              wall: deadline(index.config.options.timeoutMs, signal),
            },
          })
        : [null];
      await writeVectors(index, [row], values, signal);
    } catch (error) {
      recordEmbeddingFailure(index, error);
      throw error;
    }
  } catch (error) {
    // The content already committed; a transient failure leaves it pending.
    log(
      "ai.embedding-deferred",
      { stage: error instanceof AiError ? error.reason : "unavailable" },
      "warn",
    );
  }
}
// The committed row is the durable queue. Limit best-effort immediate work
// so a busy process cannot accumulate content or hold up write responses.
export function scheduleEmbedding(row: IndexRow) {
  const state = runtimeState();
  if (!state.embeddingProbe?.ready) return;
  const active = (state.activeEmbeddingWrites ??= new Set());
  if (active.size >= 2) return;
  const work = embedCommitted(row);
  active.add(work);
  void work.finally(() => active.delete(work));
}
export function postEmbeddingText(title: string, plainText: string) {
  return plainText.trim() ? title + "\n" + plainText : "";
}
export async function backfillBatch(
  index: IndexSnapshot,
  lease: Lease,
  signal: AbortSignal,
) {
  if (!usableIndex(index)) return 0;
  const wall = deadline(index.config.options.timeoutMs, signal);
  const { rows } = await contentTransaction(wall.signal, (trx) =>
    sql<IndexRow>`select * from (
    (select 'post' as kind,id,revision,case when trim("plainText")='' then '' else title||chr(10)||"plainText" end as text from feedback
      where embedding is null and not "embeddingSkipped" order by id limit 64)
    union all (select 'comment' as kind,id,revision,"plainText" as text from comment
      where embedding is null and not "embeddingSkipped" order by id limit 64)) candidates order by id,kind limit 64`.execute(
      trx,
    ),
  );
  const batch: IndexRow[] = [];
  let tokens = 0,
    bytes = 0;
  for (const row of rows) {
    wall.signal.throwIfAborted();
    const prepared = prepareEmbedding(
      index.config.options.embeddingModel,
      row.text,
    );
    if (
      tokens + (prepared?.tokens ?? 0) > 32000 ||
      bytes + (prepared?.bytes ?? 0) > 128000
    )
      break;
    tokens += prepared?.tokens ?? 0;
    bytes += prepared?.bytes ?? 0;
    batch.push({ ...row, text: prepared?.text ?? "" });
    await yieldTurn();
  }
  async function send(items: IndexRow[]): Promise<number> {
    wall.signal.throwIfAborted();
    const texts = items.map((row) => row.text);
    const controls = {
      lease,
      signal: wall.signal,
      content: { config: index.config, wall },
    };
    const attempt = async () => {
      const vectors = await callEmbeddings("backfill", texts, controls);
      return writeVectors(index, items, vectors, wall.signal, lease);
    };
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof AiError) || error.reason !== "provider-input")
        throw error;
    }
    // An unclassified 4xx can be a global provider/configuration error.
    // Verify a known-good control before isolating or skipping any content.
    await callEmbeddings("backfill", ["Feedbackland index check"], controls);
    if (items.length === 1) {
      try {
        return await attempt();
      } catch (error) {
        if (!(error instanceof AiError) || error.reason !== "provider-input")
          throw error;
        return writeVectors(index, items, [null], wall.signal, lease);
      }
    }
    const half = Math.floor(items.length / 2);
    return (await send(items.slice(0, half))) + (await send(items.slice(half)));
  }
  let written = 0;
  const size = embeddingRequestLimit(index.config.dimensions);
  try {
    for (let start = 0; start < batch.length; start += size) {
      written += await send(batch.slice(start, start + size));
    }
  } catch (error) {
    recordEmbeddingFailure(index, error);
    throw error;
  }
  return written;
}
