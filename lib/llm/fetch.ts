import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  OPENROUTER_API,
  MODEL_RESPONSE_BYTES,
  METADATA_RESPONSE_BYTES,
  type Capability,
  type Feature,
} from "./constants";
import { privacyRouting } from "./defaults";
import { AiError, responseError, safeError } from "./errors";
import {
  beginAttempt,
  admitMetadata,
  type Admission,
  type Reservation,
  type Usage,
  type CheckAction,
} from "./usage";
import type { Configuration } from "./settings-store";
import type { Actor } from "../auth/authorization";

export type Dispatch = {
  config: Configuration;
  feature: Feature;
  capability: Capability;
  signal: AbortSignal;
  action?: CheckAction;
  reservation?: Reservation;
  admission?: Admission;
  error?: AiError;
  usage: Usage;
};
export const dispatchContext = new AsyncLocalStorage<Dispatch>();
const metadataPaths = {
  key: "/key",
  chatModels: "/models/user",
  embeddingModels: "/models/user?output_modalities=embeddings",
} as const;
export type MetadataKind = keyof typeof metadataPaths;
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function boundedBody(
  response: Response,
  limit: number,
  signal: AbortSignal,
  ctx?: Dispatch,
) {
  const reader = response.body?.getReader();
  if (!reader) throw new AiError("invalid-response");
  let total = 0,
    stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    signal.removeEventListener("abort", abort);
  };
  const cancel = () => {
    stop();
    void reader.cancel().catch(() => {});
  };
  const abort = () => cancel();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) cancel();
  if (Number(response.headers.get("content-length")) > limit) {
    cancel();
    throw new AiError("response-too-large");
  }
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        signal.throwIfAborted();
        const { value, done } = await reader.read();
        signal.throwIfAborted();
        if (done) {
          stop();
          controller.close();
          return;
        }
        total += value.byteLength;
        if (total > limit) throw new AiError("response-too-large");
        controller.enqueue(value);
      } catch (error) {
        cancel();
        const failure = safeError(error, signal);
        if (ctx) ctx.error = failure;
        controller.error(failure);
      }
    },
    cancel,
  });
}
function readUsage(data: Record<string, unknown>): Usage {
  const usage = object(data.usage);
  return {
    cost: usage.cost,
    inputTokens:
      typeof usage.prompt_tokens === "number"
        ? usage.prompt_tokens
        : typeof usage.total_tokens === "number"
          ? usage.total_tokens
          : undefined,
    outputTokens:
      typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : undefined,
  };
}
async function send(
  path: string,
  key: string,
  body: string | undefined,
  signal: AbortSignal,
  limit: number,
  ctx?: Dispatch,
) {
  signal.throwIfAborted();
  const result = await fetch(OPENROUTER_API + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: "Bearer " + key,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body,
    redirect: "manual",
    signal,
    cache: "no-store",
  });
  if (result.status >= 300 && result.status < 400) {
    void result.body?.cancel().catch(() => {});
    throw new AiError("provider-error", result.status);
  }
  const limited = new Response(boundedBody(result, limit, signal, ctx), {
    headers: {
      "content-type": result.headers.get("content-type") ?? "application/json",
    },
  });
  if (!result.ok) {
    const raw = await limited.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      /* Unrecognized error body. */
    }
    if (ctx) ctx.usage = readUsage(object(data));
    throw responseError(result.status, data, result.headers.get("retry-after"));
  }
  return limited;
}
export const providerFetch: typeof fetch = async (input, init) => {
  const ctx = dispatchContext.getStore();
  if (!ctx || ctx.admission || !ctx.config.apiKey)
    throw new AiError("AI_UNAVAILABLE");
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const path =
      ctx.capability === "chat" ? "/chat/completions" : "/embeddings";
    if (
      url !== OPENROUTER_API + path ||
      init?.method !== "POST" ||
      typeof init.body !== "string"
    )
      throw new AiError("invalid-input");
    const body = object(JSON.parse(init.body));
    body.provider = privacyRouting(ctx.config.options.privacy);
    const payload = JSON.stringify(body);
    if (Buffer.byteLength(payload) > 6_000_000)
      throw new AiError("invalid-input");
    ctx.signal.throwIfAborted();
    ctx.admission = await beginAttempt(
      ctx.config,
      ctx.feature,
      ctx.capability,
      ctx.action,
      ctx.reservation,
    );
    const result = await send(
      path,
      ctx.config.apiKey,
      payload,
      ctx.signal,
      MODEL_RESPONSE_BYTES,
      ctx,
    );
    if (
      body.stream === true &&
      result.headers.get("content-type")?.includes("text/event-stream")
    )
      return result;
    const text = await result.text();
    let data;
    try {
      data = object(JSON.parse(text));
    } catch {
      throw new AiError("invalid-response");
    }
    ctx.usage = readUsage(data);
    if (data.error) throw responseError(200, data, null);
    if (ctx.capability === "embeddings") {
      // The compatible SDK discards response indexes. Validate and restore input
      // order before it can associate a vector with the wrong board item.
      const count = Array.isArray(body.input) ? body.input.length : 1;
      if (!Array.isArray(data.data) || data.data.length !== count)
        throw new AiError("invalid-response");
      const sorted = new Array<unknown>(count);
      for (const entry of data.data) {
        const { index, embedding } = object(entry);
        if (
          typeof index !== "number" ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= count ||
          sorted[index] !== undefined ||
          !Array.isArray(embedding) ||
          embedding.length !== ctx.config.dimensions ||
          embedding.some(
            (value) => typeof value !== "number" || !Number.isFinite(value),
          )
        )
          throw new AiError("invalid-response");
        sorted[index] = entry;
      }
      data.data = sorted;
    }
    if (body.stream === true) throw new AiError("invalid-response");
    return new Response(
      ctx.capability === "embeddings" ? JSON.stringify(data) : text,
      { headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    ctx.error = safeError(error, ctx.signal);
    throw ctx.error;
  }
};
export type KeyInfo = {
  usage: number | null;
  expiresAt: string | null;
  limit: number | null;
  remaining: number | null;
  freeTier: boolean;
  management: boolean;
  expired: boolean;
};
export type ModelInfo = {
  id: string;
  inputPrice: string | null;
  outputPrice: string | null;
  vision: boolean;
};
export async function metadata(
  config: Configuration,
  kind: MetadataKind,
  actor: Actor | undefined,
  signal: AbortSignal,
): Promise<KeyInfo | ModelInfo[]> {
  if (!Object.hasOwn(metadataPaths, kind) || !config.apiKey)
    throw new AiError("invalid-input");
  await admitMetadata(config, actor);
  const res = await send(
    metadataPaths[kind],
    config.apiKey,
    undefined,
    signal,
    METADATA_RESPONSE_BYTES,
  );
  let raw: unknown;
  try {
    raw = object(await res.json()).data;
  } catch (error) {
    if (error instanceof SyntaxError) throw new AiError("invalid-response");
    throw error;
  }
  if (kind === "key") {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new AiError("invalid-response");
    const data = object(raw);
    const amount = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    const expires =
      typeof data.expires_at === "string" ? Date.parse(data.expires_at) : NaN;
    return {
      usage: amount(data.usage),
      expiresAt: Number.isFinite(expires)
        ? new Date(expires).toISOString()
        : null,
      limit: amount(data.limit),
      remaining: amount(data.limit_remaining),
      freeTier: data.is_free_tier === true,
      management:
        data.is_management_key === true || data.is_provisioning_key === true,
      expired: expires <= Date.now(),
    };
  }
  if (!Array.isArray(raw)) throw new AiError("invalid-response");
  return raw.flatMap((item) => {
    const row = object(item),
      pricing = object(row.pricing);
    if (
      typeof row.id !== "string" ||
      row.id.length > 256 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(row.id)
    )
      return [];
    const price = (v: unknown) =>
      typeof v === "string" && /^\d{1,8}(?:\.\d{1,16})?$/.test(v) ? v : null;
    const modalities = object(row.architecture).input_modalities;
    return [
      {
        id: row.id,
        inputPrice: price(pricing.prompt),
        outputPrice: price(pricing.completion),
        vision: Array.isArray(modalities) && modalities.includes("image"),
      },
    ];
  });
}
