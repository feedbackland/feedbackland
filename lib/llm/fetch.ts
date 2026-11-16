import "server-only";
import { validCosineVector } from "../vector-values";
import { z } from "zod";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  OPENROUTER_API,
  MODEL_RESPONSE_BYTES,
  METADATA_RESPONSE_BYTES,
  type Capability,
  type Feature,
} from "./constants";
import { privacyRouting } from "./defaults";
import {
  AiError,
  EmbeddingWidthError,
  responseError,
  safeError,
} from "./errors";
import {
  beginAttempt,
  cancelUndispatched,
  cancelUndispatchedMetadata,
  admitMetadata,
  type Admission,
  type Reservation,
  type Usage,
} from "./usage";
import {
  recordModelVision,
  type Configuration,
  type CheckTicket,
} from "./settings-store";
import { checkDeadline, type Deadline } from "./deadline";
import type { Actor } from "../auth/authorization";

export type Dispatch = {
  config: Configuration;
  feature: Feature;
  capability: Capability;
  signal: AbortSignal;
  end: number;
  check?: CheckTicket;
  reservation?: Reservation;
  lease?: import("../jobs/leases").Lease;
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
export function observeStreamFrame(ctx: Dispatch, frame: unknown) {
  const data = object(frame);
  if (data.usage) {
    const usage = readUsage(data);
    ctx.usage = {
      inputTokens: usage.inputTokens ?? ctx.usage.inputTokens,
      outputTokens: usage.outputTokens ?? ctx.usage.outputTokens,
      cost: usage.cost ?? ctx.usage.cost,
    };
  }
  if (data.error) ctx.error = responseError(200, data, null);
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
    const admission = await beginAttempt(
      ctx.config,
      ctx.feature,
      ctx.capability,
      ctx.check,
      ctx.reservation,
      ctx,
      ctx.lease,
    );
    try {
      checkDeadline(ctx);
      if (
        admission.leaseEnd !== undefined &&
        performance.now() >= admission.leaseEnd
      )
        throw new AiError("RESERVATION_EXPIRED");
    } catch (error) {
      void cancelUndispatched(admission, ctx.reservation);
      throw error;
    }
    ctx.admission = admission;
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
          Array.isArray(embedding) &&
          embedding.length !== ctx.config.dimensions
        )
          throw new EmbeddingWidthError(
            ctx.config.dimensions,
            embedding.length,
          );
        if (
          typeof index !== "number" ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= count ||
          sorted[index] !== undefined ||
          !validCosineVector(embedding, ctx.config.dimensions)
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
const amount = z.number().finite().nonnegative();
const keyMetadata = z.object({
  usage: amount,
  limit: amount.nullable(),
  limit_remaining: amount.nullable(),
  is_free_tier: z.boolean(),
  is_management_key: z.boolean().optional(),
  is_provisioning_key: z.boolean().optional(),
  expires_at: z.iso.datetime({ offset: true }).nullish(),
});
function keyInfo(raw: unknown) {
  const result = keyMetadata.safeParse(raw);
  if (!result.success) throw new AiError("invalid-response");
  const data = result.data;
  const expiresAt = data.expires_at;
  return {
    usage: data.usage,
    limit: data.limit,
    remaining: data.limit_remaining,
    freeTier: data.is_free_tier,
    expiresAt: expiresAt ?? null,
    expired:
      expiresAt === undefined
        ? null
        : !!expiresAt && Date.parse(expiresAt) <= Date.now(),
    management:
      data.is_management_key === true || data.is_provisioning_key === true
        ? true
        : (data.is_management_key ?? data.is_provisioning_key ?? null),
  };
}
export type KeyInfo = ReturnType<typeof keyInfo>;
export type ModelInfo = {
  id: string;
  inputPrice: string | null;
  outputPrice: string | null;
  vision: boolean | null;
};
export async function metadata(
  config: Configuration,
  kind: MetadataKind,
  actor: Actor | undefined,
  wall: Deadline,
  check?: CheckTicket,
  lease?: import("../jobs/leases").Lease,
): Promise<KeyInfo | ModelInfo[]> {
  if (!Object.hasOwn(metadataPaths, kind) || !config.apiKey)
    throw new AiError("invalid-input");
  const { windows, leaseEnd } = await admitMetadata(
    config,
    actor,
    check,
    wall,
    kind,
    lease,
  );
  try {
    checkDeadline(wall);
    if (leaseEnd !== undefined && performance.now() >= leaseEnd)
      throw new AiError("RESERVATION_EXPIRED");
  } catch (error) {
    void cancelUndispatchedMetadata(windows);
    throw error;
  }
  const res = await send(
    metadataPaths[kind],
    config.apiKey,
    undefined,
    wall.signal,
    METADATA_RESPONSE_BYTES,
  );
  let raw: unknown;
  try {
    raw = object(await res.json()).data;
  } catch (error) {
    if (error instanceof SyntaxError) throw new AiError("invalid-response");
    throw error;
  }
  if (kind === "key") return keyInfo(raw);
  if (!Array.isArray(raw)) throw new AiError("invalid-response");
  const models = raw.flatMap((item) => {
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
        vision: Array.isArray(modalities) ? modalities.includes("image") : null,
      },
    ];
  });
  if (kind === "chatModels") await recordModelVision(config, models, wall);
  return models;
}
