import "server-only";
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
import type { Actor } from "../auth/authorization";
import {
  OPENROUTER_API,
  VISION_WORK_BYTES,
  type Capability,
  type Feature,
} from "./constants";
import { outputTokens, privacyRouting, type ChatFeature } from "./defaults";
import {
  configuration,
  failingCapability,
  type Configuration,
} from "./settings-store";
import { finishAttempt, type Reservation, type CheckAction } from "./usage";
import { AiError, safeError, logFailure } from "./errors";
import {
  prepareChat,
  planVision,
  type ChatInput,
  type VisionAsset,
} from "./input-budgets";
import { embeddingBatch } from "./model-profiles";
import {
  providerFetch,
  dispatchContext,
  metadata,
  type Dispatch,
  type MetadataKind,
} from "./fetch";

const provider = createOpenAICompatible({
  name: "openrouter",
  baseURL: OPENROUTER_API,
  includeUsage: true,
  fetch: providerFetch,
  transformRequestBody(body) {
    if (body.feedbackland_cache !== true) return body;
    const rest = { ...body };
    delete rest.feedbackland_cache;
    return {
      ...rest,
      messages: body.messages.map((m: { role: string; content: unknown }) =>
        m.role === "system" && typeof m.content === "string"
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
globalThis.AI_SDK_DEFAULT_PROVIDER = provider;
globalThis.AI_SDK_LOG_WARNINGS = false;
type Controls = {
  signal?: AbortSignal;
  action?: CheckAction;
  reservation?: Reservation;
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
async function ready(
  feature: Feature | "metadata",
  cap: Capability,
  admin = false,
) {
  const config = await configuration(),
    diagnostic =
      feature === "check" || feature === "metadata" || feature === "probe";
  if (config.diverged) throw new AiError("CONFIGURATION_DIVERGED");
  if (
    (config.enabled === false && !admin) ||
    (!config.configured && !diagnostic)
  )
    throw new AiError("AI_NOT_CONFIGURED");
  if (config.unreadable) throw new AiError("key-unreadable");
  if (!config.apiKey) throw new AiError("AI_NOT_CONFIGURED");
  if (
    !diagnostic &&
    ((config.check &&
      ["invalid", "management", "expired"].includes(config.check.key)) ||
      (await failingCapability(config, cap)))
  )
    throw new AiError("AI_UNAVAILABLE");
  return config;
}
function deadline(
  config: Configuration,
  feature: Feature | "metadata",
  external?: AbortSignal,
) {
  const duration =
    feature === "insights"
      ? Math.min(6 * config.options.timeoutMs, 180000)
      : feature === "ask-ai"
        ? 180000
        : config.options.timeoutMs;
  const timeout = AbortSignal.timeout(duration);
  return {
    end: performance.now() + duration,
    signal: external ? AbortSignal.any([external, timeout]) : timeout,
  };
}
async function execute<T>(
  feature: Feature,
  capability: Capability,
  vision: boolean,
  controls: Controls,
  operation: (ctx: Dispatch) => Promise<T>,
) {
  let release: (() => void) | undefined, signal: AbortSignal | undefined;
  try {
    release = acquire(vision ? "vision" : "model");
    const config = await ready(
      feature,
      capability,
      !!controls.action && feature === "check",
    );
    const wall = deadline(config, feature, controls.signal);
    signal = wall.signal;
    signal.throwIfAborted();
    if (vision && !config.options.vision) throw new AiError("invalid-input");
    for (let attempt = 0; ; attempt++) {
      const ctx: Dispatch = {
        config,
        feature,
        capability,
        signal,
        action: controls.action,
        reservation: controls.reservation,
        usage: {},
      };
      let failure: AiError | undefined;
      try {
        return await dispatchContext.run(ctx, () => operation(ctx));
      } catch (error) {
        failure = ctx.error ?? safeError(error, signal);
      } finally {
        if (ctx.admission)
          await finishAttempt(ctx.admission, ctx.usage, failure);
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
function setUsage(ctx: Dispatch, usage: LanguageModelUsage) {
  ctx.usage = {
    inputTokens: usage.inputTokens ?? ctx.usage.inputTokens,
    outputTokens: usage.outputTokens ?? ctx.usage.outputTokens,
    cost: usage.raw?.cost ?? ctx.usage.cost,
  };
}
export async function callChat(
  feature: ChatFeature,
  input: ChatInput,
  controls: Controls & {
    images?: readonly VisionAsset[];
    onText?: (delta: string) => void;
  } = {},
) {
  const prepared = prepareChat(feature, input);
  const vision = planVision(controls.images ?? []);
  if (
    (vision.length && !["moderation", "check"].includes(feature)) ||
    (controls.onText && feature !== "ask-ai")
  )
    throw new AiError("invalid-input");
  return execute(feature, "chat", !!vision.length, controls, async (ctx) => {
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
      model: provider.chatModel(ctx.config.options.model),
      system: prepared.system,
      messages,
      maxRetries: 0,
      maxOutputTokens: outputTokens[feature],
      abortSignal: ctx.signal,
      providerOptions: {
        openrouter: {
          provider: privacyRouting(ctx.config.options.privacy),
          ...(feature === "rewrite"
            ? {}
            : {
                reasoning: {
                  effort: feature === "ask-ai" ? "medium" : "low",
                  ...(feature === "insights" ? { exclude: true } : {}),
                },
              }),
          ...(["moderation", "title", "insights", "check"].includes(feature)
            ? { response_format: { type: "json_object" } }
            : {}),
          ...(feature === "ask-ai" ? { feedbackland_cache: true } : {}),
        },
      },
    };
    if (controls.onText) {
      const timer = new AbortController();
      let idle: ReturnType<typeof setTimeout> | undefined;
      const reset = () => {
        clearTimeout(idle);
        idle = setTimeout(
          () => timer.abort(new DOMException("Timeout", "TimeoutError")),
          ctx.config.options.timeoutMs,
        );
      };
      ctx.signal = AbortSignal.any([ctx.signal, timer.signal]);
      reset();
      try {
        const result = streamText({
          ...args,
          abortSignal: ctx.signal,
          onError: () => {},
        });
        let text = "",
          finished = false;
        for await (const part of result.fullStream) {
          if (part.type === "error")
            throw ctx.error ?? safeError(part.error, ctx.signal);
          if (part.type === "abort") throw safeError(null, ctx.signal);
          if (part.type === "text-delta" && part.text) {
            reset();
            text += part.text;
            controls.onText(part.text);
          }
          if (part.type === "reasoning-delta" && part.text) reset();
          if (part.type === "finish-step") {
            setUsage(ctx, part.usage);
            checkFinish(part.rawFinishReason, part.finishReason);
            finished = true;
          }
        }
        if (!finished) throw ctx.error ?? safeError(null, ctx.signal);
        return { text, omitted: prepared.omitted };
      } finally {
        clearTimeout(idle);
      }
    }
    const result = await generateText(args);
    setUsage(ctx, result.steps[0].usage);
    checkFinish(result.rawFinishReason, result.finishReason);
    return { text: result.text, omitted: prepared.omitted };
  });
}
function checkFinish(raw: string | undefined, reason: string) {
  if (raw === "content_filter" || reason === "content-filter")
    throw new AiError("provider-refusal");
  if (raw === "error" || reason === "error")
    throw new AiError("provider-error");
}
export function callEmbeddings(
  feature: "embed-write" | "embed-query" | "backfill" | "probe" | "check",
  items: readonly string[],
  controls: Controls = {},
) {
  return execute(feature, "embeddings", false, controls, async (ctx) => {
    const { options, dimensions } = ctx.config;
    if (ctx.config.widthMismatch) throw new AiError("AI_UNAVAILABLE");
    if (options.embeddingModel === "none")
      throw new AiError("AI_NOT_CONFIGURED");
    const values = embeddingBatch(
      options.embeddingModel,
      items,
      feature === "embed-query",
    );
    if (!values.length) return [];
    const args = {
      model: provider.textEmbeddingModel(options.embeddingModel),
      maxRetries: 0,
      abortSignal: ctx.signal,
      providerOptions: { openrouter: { dimensions } },
    };
    return values.length === 1
      ? [(await embed({ ...args, value: values[0] })).embedding]
      : (await embedMany({ ...args, values, maxParallelCalls: 1 })).embeddings;
  });
}
export async function readProviderMetadata(
  kind: MetadataKind,
  actor?: Actor,
  external?: AbortSignal,
) {
  let release: (() => void) | undefined, signal: AbortSignal | undefined;
  try {
    release = acquire("metadata");
    const config = await ready("metadata", "chat", !!actor);
    signal = deadline(config, "metadata", external).signal;
    signal.throwIfAborted();
    return await metadata(config, kind, actor, signal);
  } catch (error) {
    const failure = safeError(error, signal);
    logFailure(failure, "metadata");
    throw failure;
  } finally {
    release?.();
  }
}
