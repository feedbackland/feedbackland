import "server-only";
import { embeddingRequestLimit } from "../ai-request-limits";
export { embeddingRequestLimit };
import { z } from "zod";
import { getConfig } from "../config";
import { deadline, checkDeadline, type Deadline } from "./deadline";
import { setTimeout as pause } from "node:timers/promises";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  generateText,
  streamText,
  embed,
  embedMany,
  type ModelMessage,
  type LanguageModelUsage,
} from "ai";
import { runtimeState } from "../runtime-state";
import { ASK_AI_STREAM_MS } from "../ask-ai";
import type { Actor } from "../auth/authorization";
import {
  OPENROUTER_API,
  VISION_WORK_BYTES,
  type Capability,
  type Feature,
} from "./constants";
import {
  defaults,
  outputTokens,
  privacyRouting,
  type ChatFeature,
  type Options,
} from "./defaults";
import {
  configuration,
  capabilityFailure,
  usableCheckedKey,
  type Configuration,
  type CheckTicket,
} from "./settings-store";
import { finishAttempt, type Reservation } from "./usage";
import {
  AiError,
  UnavailableCapability,
  safeError,
  logFailure,
} from "./errors";
import {
  prepareChat,
  planVision,
  type ChatInput,
  type VisionAsset,
} from "./input-budgets";
import { embeddingBatch } from "./model-profiles";
import {
  providerFetch,
  modelRequest,
  sendModel,
  type ModelWireState,
  dispatchContext,
  observeStreamFrame,
  metadata,
  type Dispatch,
  type MetadataKind,
} from "./fetch";

const compatible = (transport: typeof fetch) =>
  createOpenAICompatible({
    name: "openrouter",
    baseURL: OPENROUTER_API,
    includeUsage: true,
    fetch: transport,
    transformRequestBody(body) {
      const marker = body.feedbackland_cache;
      if (marker !== "system" && marker !== "corpus") return body;
      const rest = { ...body };
      delete rest.feedbackland_cache;
      return {
        ...rest,
        messages: body.messages.map(
          (m: { role: string; content: unknown }, index: number) =>
            index === (marker === "corpus" ? 1 : 0) &&
            typeof m.content === "string"
              ? {
                  ...m,
                  content: [
                    {
                      type: "text",
                      text: m.content,
                      cache_control: { type: "ephemeral" },
                    },
                  ],
                }
              : m,
        ),
      };
    },
  });
const provider = compatible(providerFetch);
globalThis.AI_SDK_DEFAULT_PROVIDER = provider;
globalThis.AI_SDK_LOG_WARNINGS = false;
const heldInsightSlot = Symbol("held insight model slot");
type Controls = {
  [heldInsightSlot]?: true;
  lease?: import("../jobs/leases").Lease;
  signal?: AbortSignal;
  actor?: Actor;
  check?: CheckTicket;
  reservation?: Reservation;
  content?: { config: Configuration; wall: Deadline };
};
function acquire(kind: "model" | "vision" | "metadata") {
  const work = (runtimeState().aiWork ??= { model: 0, vision: 0, metadata: 0 });
  const amount = kind === "vision" ? VISION_WORK_BYTES : 1;
  if (
    work[kind] + amount >
    (kind === "model" ? 8 : kind === "metadata" ? 2 : VISION_WORK_BYTES)
  )
    throw new AiError(kind === "vision" ? "VISION_BUSY" : "AI_BUSY", 429, 5000);
  work[kind] += amount;
  return () => {
    work[kind] -= amount;
  };
}
export function acquireInsightSlot() {
  const release = acquire("model");
  let active = true;
  return {
    chat<T>(
      input: ChatInput,
      reservation: Reservation,
      signal: AbortSignal,
      validateText: (text: string) => T,
    ) {
      if (!active) throw new AiError("RESERVATION_EXPIRED");
      return callChat("insights", input, {
        reservation,
        signal,
        validateText,
        [heldInsightSlot]: true,
      });
    },
    release() {
      if (active) {
        active = false;
        release();
      }
    },
  };
}
export type InsightSlot = ReturnType<typeof acquireInsightSlot>;

function duration(feature: Feature | "metadata", timeout: number) {
  if (feature === "insights") return Math.min(6 * timeout, 180000);
  if (feature === "ask-ai") return ASK_AI_STREAM_MS;
  return timeout;
}
export function initialAiTimeout() {
  return (
    getConfig().llm.options.timeoutMs ??
    runtimeState().aiConfig?.value.options.timeoutMs ??
    defaults.timeoutMs
  );
}
async function ready(
  feature: Feature | "metadata",
  cap: Capability,
  controls: Controls,
  metadataAdmin = false,
) {
  const start = performance.now();
  const knownTimeout = initialAiTimeout();
  const initial =
    controls.content?.wall ??
    deadline(
      feature === "ask-ai" ? knownTimeout : duration(feature, knownTimeout),
      controls.signal,
      start,
    );
  const config =
    controls.content?.config ??
    (await configuration(
      initial.signal,
      !!controls.reservation || !!controls.check || metadataAdmin,
    ).catch((error) => {
      throw safeError(error, initial.signal);
    }));
  const wall =
    controls.content?.wall ??
    deadline(
      duration(feature, config.options.timeoutMs),
      controls.signal,
      start,
    );
  const readiness =
    feature === "ask-ai"
      ? deadline(config.options.timeoutMs, controls.signal, start)
      : wall;
  checkDeadline(readiness);
  if (controls.reservation && controls.reservation.configToken !== config.token)
    throw new AiError("STALE_CONFIGURATION");
  const diagnostic =
    feature === "check" || feature === "metadata" || feature === "probe";
  if (!diagnostic && config.keyless) throw new AiError("AI_NOT_CONFIGURED");
  if (!config.valid) throw new AiError("AI_UNAVAILABLE");
  if (config.diverged) throw new AiError("CONFIGURATION_DIVERGED");
  const admin = metadataAdmin || !!controls.check?.action;
  if (
    !config.configured &&
    !(
      diagnostic &&
      (admin || (controls.check?.creditWait && config.enabled === null))
    )
  )
    throw new AiError("AI_NOT_CONFIGURED");
  if (config.unreadable) throw new AiError("key-unreadable");
  if (!config.apiKey) throw new AiError("AI_NOT_CONFIGURED");
  if (!diagnostic) {
    if (!usableCheckedKey(config))
      throw new UnavailableCapability("provider-auth");
    const failure = await capabilityFailure(
      config,
      cap,
      readiness.signal,
    ).catch((error) => {
      throw safeError(error, readiness.signal);
    });
    if (failure) throw new UnavailableCapability(failure.lastReason);
  }
  return { config, wall };
}

async function execute<T>(
  feature: Feature,
  capability: Capability,
  vision: boolean,
  controls: Controls,
  operation: (ctx: Dispatch) => Promise<T>,
  snapshot?: { config: Configuration; wall: Deadline },
) {
  let release: (() => void) | undefined;
  let signal = controls.content?.wall.signal ?? controls.signal;
  try {
    if (!controls[heldInsightSlot])
      release = acquire(vision ? "vision" : "model");
    const { config, wall } =
      snapshot ?? (await ready(feature, capability, controls));
    signal = wall.signal;
    signal.throwIfAborted();
    if (vision && !config.options.vision) throw new AiError("invalid-input");
    for (let attempt = 0; ; attempt++) {
      const ctx: Dispatch = {
        config,
        feature,
        capability,
        signal,
        end: wall.end,
        check: controls.check,
        actor: controls.actor,
        reservation: controls.reservation,
        lease: controls.lease,
        usage: {},
      };
      let failure: AiError | undefined;
      try {
        return await dispatchContext.run(ctx, () => operation(ctx));
      } catch (error) {
        failure = ctx.error ?? safeError(error, signal);
      } finally {
        if (ctx.admission) {
          // Settlement has its own short transaction. It can finish after a
          // caller disconnects or the request deadline releases the slot.
          const settlement = finishAttempt(ctx.admission, ctx.usage, failure);
          if (!ctx.signal.aborted) {
            const { promise, resolve } = Promise.withResolvers<void>();
            const leave = () => resolve();
            ctx.signal.addEventListener("abort", leave, { once: true });
            try {
              await Promise.race([settlement, promise]);
            } finally {
              ctx.signal.removeEventListener("abort", leave);
            }
          }
        }
      }
      if (
        attempt ||
        feature !== "check" ||
        (failure.reason !== "data-policy" &&
          failure.reason !== "in-flight-budget")
      )
        throw failure;
      const delay =
        failure.reason === "in-flight-budget" ? failure.retryAfterMs : 0;
      if (
        delay === undefined ||
        delay > 5000 ||
        delay >= wall.end - performance.now()
      )
        throw failure;
      if (delay) await pause(delay, undefined, { signal });
    }
  } catch (error) {
    const failure = safeError(error, signal);
    logFailure(failure, feature);
    throw failure;
  } finally {
    release?.();
  }
}
function setUsage(ctx: ModelWireState, usage: LanguageModelUsage) {
  ctx.usage = {
    inputTokens: usage.inputTokens ?? ctx.usage.inputTokens,
    outputTokens: usage.outputTokens ?? ctx.usage.outputTokens,
    cost: usage.raw?.cost ?? ctx.usage.cost,
  };
}
type ChatCallbacks<T> = {
  validateText?: (text: string) => T;
  onText?: (delta: string, included: number) => void;
};

async function runChat<T>(
  engine: ReturnType<typeof compatible>,
  feature: ChatFeature,
  prepared: ReturnType<typeof prepareChat>,
  vision: readonly VisionAsset[],
  options: Options,
  ctx: Deadline & ModelWireState,
  controls: ChatCallbacks<T>,
) {
  const messages: ModelMessage[] = [...prepared.messages];
  if (vision.length) {
    const parts: Array<
      | { type: "text"; text: string }
      | { type: "image"; image: Uint8Array; mediaType: string }
    > = [{ type: "text", text: prepared.messages.at(-1)!.content }];
    for (const asset of vision) {
      ctx.signal.throwIfAborted();
      const bytes = await asset.load(ctx.signal);
      ctx.signal.throwIfAborted();
      if (bytes.byteLength !== asset.byteSize)
        throw new AiError("invalid-input");
      parts.push({
        type: "image",
        image: bytes,
        mediaType: asset.contentType,
      });
    }
    messages[messages.length - 1] = { role: "user", content: parts };
  }
  const args = {
    model: engine.chatModel(options.model),
    system: prepared.system,
    messages,
    maxRetries: 0,
    maxOutputTokens: outputTokens[feature],
    abortSignal: ctx.signal,
    providerOptions: {
      openrouter: {
        provider: privacyRouting(options.privacy),
        reasoning: {
          effort:
            feature === "ask-ai"
              ? "low"
              : feature === "insights"
                ? "medium"
                : "minimal",
          ...(feature === "insights" ? { exclude: true } : {}),
        },
        ...(["moderation", "title", "insights", "check"].includes(feature)
          ? { response_format: { type: "json_object" } }
          : {}),
        ...(feature === "ask-ai"
          ? { feedbackland_cache: prepared.cacheCorpus ? "corpus" : "system" }
          : {}),
      },
    },
  };
  if (feature === "ask-ai") {
    const timer = new AbortController();
    let idle: ReturnType<typeof setTimeout> | undefined;
    const reset = (ms = options.timeoutMs) => {
      clearTimeout(idle);
      idle = setTimeout(
        () => timer.abort(new DOMException("Timeout", "TimeoutError")),
        ms,
      );
    };
    ctx.signal = AbortSignal.any([ctx.signal, timer.signal]);
    const firstTokenMs =
      ctx.end - ASK_AI_STREAM_MS + options.timeoutMs - performance.now();
    if (firstTokenMs <= 0) throw new AiError("timeout");
    reset(firstTokenMs);
    try {
      const result = streamText({
        ...args,
        abortSignal: ctx.signal,
        includeRawChunks: true,
        onError: () => {},
      });
      let text = "";
      let finish: "stop" | "length" | undefined;
      for await (const part of result.fullStream) {
        if (part.type === "raw") observeStreamFrame(ctx, part.rawValue);
        if (part.type === "error")
          throw ctx.error ?? safeError(part.error, ctx.signal);
        if (part.type === "abort") throw safeError(null, ctx.signal);
        if (part.type === "text-delta" && part.text) {
          reset();
          text += part.text;
          controls.onText?.(part.text, prepared.included);
        }
        if (part.type === "reasoning-delta" && part.text) reset();
        if (part.type === "finish-step") {
          setUsage(ctx, part.usage);
          if (ctx.error) throw ctx.error;
          checkFinish(part.rawFinishReason, part.finishReason);
          if (part.finishReason !== "stop" && part.finishReason !== "length")
            throw new AiError("invalid-response");
          finish = part.finishReason;
        }
      }
      if (ctx.signal.aborted) throw safeError(null, ctx.signal);
      if (!finish || !text.trim())
        throw ctx.error ?? new AiError("invalid-response");
      return {
        text,
        omitted: prepared.omitted,
        truncated: finish === "length",
      };
    } finally {
      clearTimeout(idle);
    }
  }
  const result = await generateText(args);
  setUsage(ctx, result.steps[0].usage);
  checkFinish(result.rawFinishReason, result.finishReason);
  if (
    (feature === "title" || feature === "rewrite" || feature === "insights") &&
    result.finishReason !== "stop"
  )
    throw new AiError("invalid-response");
  if (feature === "moderation") {
    const moderation = parseModeration(result.text, result.finishReason);
    return { text: result.text, omitted: prepared.omitted, moderation };
  }
  return {
    text: result.text,
    omitted: prepared.omitted,
    value: controls.validateText?.(result.text),
  };
}
type ChatControls<T> = ChatCallbacks<T> & { images?: readonly VisionAsset[] };

function prepareChatCall(
  feature: ChatFeature,
  input: ChatInput,
  controls: ChatControls<unknown>,
) {
  const prepared = prepareChat(feature, input);
  const vision = planVision(controls.images ?? []);
  if (
    (vision.length && !["moderation", "check"].includes(feature)) ||
    (controls.onText && feature !== "ask-ai")
  )
    throw new AiError("invalid-input");
  return { prepared, vision };
}

export async function callChat<T = never>(
  feature: ChatFeature,
  input: ChatInput,
  controls: Controls & ChatControls<T> = {},
) {
  const { prepared, vision } = prepareChatCall(feature, input, controls);
  return execute(feature, "chat", !!vision.length, controls, (ctx) =>
    runChat(
      provider,
      feature,
      prepared,
      vision,
      ctx.config.options,
      ctx,
      controls,
    ),
  );
}
const verdict = z.object({
  isInappropriate: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  titleApproved: z.boolean().optional().catch(false),
});
function parseModeration(text: string, finish: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1");
  try {
    const parsed = verdict.safeParse(JSON.parse(cleaned));
    if (finish === "stop" && parsed.success) return parsed.data;
  } catch {
    /* Return only the fixed classification. */
  }
  throw new AiError("invalid-response");
}
function checkFinish(raw: string | undefined, reason: string) {
  if (raw === "content_filter" || reason === "content-filter")
    throw new AiError("provider-refusal");
  if (raw === "error" || reason === "error")
    throw new AiError("provider-error");
}
async function runEmbedding(
  engine: ReturnType<typeof compatible>,
  embeddingModel: string,
  dimensions: number,
  values: string[],
  signal: AbortSignal,
) {
  const args = {
    model: engine.textEmbeddingModel(embeddingModel),
    maxRetries: 0,
    abortSignal: signal,
    providerOptions: { openrouter: { dimensions } },
  };
  if (values.length === 1)
    return [(await embed({ ...args, value: values[0] })).embedding];
  return (await embedMany({ ...args, values, maxParallelCalls: 1 })).embeddings;
}

// The opt-in release measurement uses the same adapter, wire checks and
// validators as the application. Its dedicated provider key governs admission.
export function calibrationClient(key: string, transport: typeof fetch) {
  async function run<T>(
    feature: Feature,
    capability: Capability,
    options: Options,
    dimensions: number,
    work: (
      engine: ReturnType<typeof compatible>,
      ctx: Deadline & ModelWireState,
    ) => Promise<T>,
  ) {
    const ctx: Deadline & ModelWireState = {
      ...deadline(duration(feature, options.timeoutMs)),
      capability,
      usage: {},
    };
    const engine = compatible(async (input, init) => {
      try {
        return await sendModel(
          modelRequest(input, init, capability, options.privacy),
          key,
          dimensions,
          ctx,
          transport,
        );
      } catch (error) {
        throw (ctx.error = safeError(error, ctx.signal));
      }
    });
    let value: T | undefined;
    let failure: AiError | undefined;
    try {
      value = await work(engine, ctx);
    } catch (error) {
      failure = ctx.error ?? safeError(error, ctx.signal);
    }
    return { value, failure, usage: ctx.usage, receipt: ctx.receipt };
  }

  return {
    chat<T>(
      feature: ChatFeature,
      input: ChatInput,
      options: Options,
      controls: ChatControls<T> = {},
    ) {
      return run(feature, "chat", options, 0, (engine, ctx) => {
        const { prepared, vision } = prepareChatCall(feature, input, controls);
        return runChat(
          engine,
          feature,
          prepared,
          vision,
          options,
          ctx,
          controls,
        );
      });
    },
    embedding(
      feature: "embed-query" | "embed-write" | "check",
      text: string,
      options: Options,
      width: number,
    ) {
      return run(feature, "embeddings", options, width, async (engine, ctx) => {
        const inputs = embeddingBatch(
          options.embeddingModel,
          [text],
          feature === "embed-query",
        );
        if (inputs.length !== 1) throw new AiError("invalid-input");
        return (
          await runEmbedding(
            engine,
            options.embeddingModel,
            width,
            [inputs[0].text],
            ctx.signal,
          )
        )[0];
      });
    },
  };
}

export async function callEmbeddings(
  feature: "embed-write" | "embed-query" | "backfill" | "probe" | "check",
  items: readonly string[],
  controls: Controls = {},
) {
  // Acquire a slot before tokenizer work, including for empty inputs.
  const release = acquire("model");
  let snapshot: Awaited<ReturnType<typeof ready>>;
  let entries: ReturnType<typeof embeddingBatch>;
  try {
    snapshot = await ready(feature, "embeddings", controls);
    const { config } = snapshot;
    if (config.widthMismatch) throw new AiError("AI_UNAVAILABLE");
    if (config.options.embeddingModel === "none")
      throw new AiError("AI_NOT_CONFIGURED");
    entries = embeddingBatch(
      config.options.embeddingModel,
      items,
      feature === "embed-query",
    );
  } finally {
    release();
  }
  const dimensions = snapshot.config.dimensions;
  // A finite IEEE-754 number uses at most 24 JSON characters, plus its comma.
  // Leave room for the provider envelope, per-row indexes and usage metadata.
  const perRequest = embeddingRequestLimit(dimensions);
  const result: (number[] | null)[] = items.map(() => null);
  for (let offset = 0; offset < entries.length; offset += perRequest) {
    const batch = entries.slice(offset, offset + perRequest);
    const vectors = await execute(
      feature,
      "embeddings",
      false,
      controls,
      async (ctx) => {
        return runEmbedding(
          provider,
          ctx.config.options.embeddingModel,
          dimensions,
          batch.map((item) => item.text),
          ctx.signal,
        );
      },
      snapshot,
    );
    batch.forEach((item, i) => {
      result[item.index] = vectors[i];
    });
  }
  return result;
}
export async function readProviderMetadata(
  kind: MetadataKind,
  actor?: Actor,
  external?: AbortSignal,
  check?: CheckTicket,
  lease?: import("../jobs/leases").Lease,
  expected?: { token: string; revision: string },
  checkedConfig?: Configuration,
) {
  let release: (() => void) | undefined, signal: AbortSignal | undefined;
  try {
    release = acquire("metadata");
    const { config, wall } = await ready(
      "metadata",
      "chat",
      {
        signal: external,
        check,
        ...(checkedConfig && check && kind === "key"
          ? {
              content: {
                config: checkedConfig,
                wall: deadline(checkedConfig.options.timeoutMs, external),
              },
            }
          : {}),
      },
      !!actor,
    );
    signal = wall.signal;
    signal.throwIfAborted();
    if (
      expected &&
      (config.token !== expected.token || config.revision !== expected.revision)
    )
      throw new AiError("STALE_CONFIGURATION");
    return await metadata(config, kind, actor, wall, check, lease);
  } catch (error) {
    const failure = safeError(error, signal);
    logFailure(failure, "metadata");
    throw failure;
  } finally {
    release?.();
  }
}
