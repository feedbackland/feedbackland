import "server-only";
import { randomUUID } from "node:crypto";
import { DomainError } from "../domain-error";
import { log } from "../log";
import type { Feature } from "./constants";

export type Reason =
  | "AI_NOT_CONFIGURED"
  | "AI_UNAVAILABLE"
  | "AI_PAUSED"
  | "AI_BUSY"
  | "VISION_BUSY"
  | "CONFIGURATION_DIVERGED"
  | "STALE_CONFIGURATION"
  | "UNSUPPORTED_EMBEDDING_TOKENIZER"
  | "RESERVATION_EXPIRED"
  | "invalid-input"
  | "forbidden"
  | "key-unreadable"
  | "provider-auth"
  | "provider-credit"
  | "provider-rate"
  | "provider-error"
  | "provider-refusal"
  | "context-length"
  | "provider-input"
  | "data-policy"
  | "in-flight-budget"
  | "timeout"
  | "aborted"
  | "invalid-response"
  | "response-too-large"
  | "limiter-error";
export class AiError extends Error {
  readonly requestId = randomUUID();
  constructor(
    readonly reason: Reason,
    readonly status: number | null = null,
    readonly retryAfterMs?: number,
    readonly creditDetail?:
      "account-credit" | "key-limit" | "request-exceeds-balance",
  ) {
    super(reason);
  }
}
export class DailyBudgetError extends AiError {
  readonly resetsAt: string;
  readonly retryAfterSeconds: number;
  constructor(window: { day: string; now: Date }) {
    super("AI_PAUSED");
    const reset = Date.parse(window.day + "T00:00:00Z") + 86400_000;
    this.resetsAt = new Date(reset).toISOString();
    this.retryAfterSeconds = Math.max(
      1,
      Math.ceil((reset - window.now.getTime()) / 1000),
    );
  }
}
export class UnavailableCapability extends AiError {
  constructor(readonly lastReason: string | null) {
    super("AI_UNAVAILABLE");
  }
}
export function safeError(error: unknown, signal?: AbortSignal): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof DomainError && error.code === "FORBIDDEN")
    return new AiError("forbidden", 403);
  if (signal?.aborted)
    return new AiError(
      signal.reason?.name === "TimeoutError" ? "timeout" : "aborted",
    );
  return new AiError("provider-error");
}
export function logFailure(error: AiError, feature: Feature | "metadata") {
  log(
    "ai.request-failed",
    {
      name: feature,
      stage: error.reason,
      target: error.requestId,
      ...(error.status === null ? {} : { count: error.status }),
    },
    "warn",
  );
}
export function responseError(
  status: number,
  data: unknown,
  retryAfter: string | null,
) {
  const envelope = (typeof data === "object" && data !== null ? data : {}) as {
    error?: {
      message?: unknown;
      code?: unknown;
      metadata?: {
        error_type?: unknown;
        limit_source?: unknown;
        reason?: unknown;
      };
    };
  };
  const err = envelope.error;
  const code =
    status === 200 &&
    typeof err?.code === "number" &&
    Number.isInteger(err.code) &&
    err.code >= 400 &&
    err.code <= 599
      ? err.code
      : status;
  const type = err?.metadata?.error_type,
    source = err?.metadata?.limit_source;
  if (
    code === 403 &&
    (type === "refusal" || type === "content_policy_violation")
  )
    return new AiError("provider-refusal", code);
  if (
    code === 401 ||
    (code === 403 &&
      (type === "authentication" || type === "permission_denied"))
  )
    return new AiError("provider-auth", code);
  if (code === 402 && source === "openrouter_in_flight_budget") {
    const date =
      retryAfter && /^[A-Za-z]{3}, .{20,32} GMT$/.test(retryAfter)
        ? Date.parse(retryAfter)
        : NaN;
    const ms =
      retryAfter && /^\d{1,5}$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : Number.isFinite(date)
          ? Math.max(0, date - Date.now())
          : undefined;
    return new AiError("in-flight-budget", code, ms);
  }
  if (code === 402) {
    const detail =
      source === "openrouter_key_limit"
        ? "key-limit"
        : source === "openrouter_credits"
          ? err?.metadata?.reason === "weight_exceeds_budget"
            ? "request-exceeds-balance"
            : "account-credit"
          : undefined;
    return new AiError("provider-credit", code, undefined, detail);
  }
  if (type === "context_length_exceeded" && [400, 413, 422].includes(code))
    return new AiError("context-length", code);
  if (code === 429) return new AiError("provider-rate", code);
  if (
    code === 404 &&
    typeof err?.message === "string" &&
    err.message
      .toLowerCase()
      .includes("no endpoints found matching your data policy")
  )
    return new AiError("data-policy", code);
  if ([400, 413, 415, 422].includes(code))
    return new AiError("provider-input", code);
  return new AiError("provider-error", code);
}
export function healthReason(error: AiError) {
  switch (error.reason) {
    case "provider-auth":
    case "provider-credit":
    case "provider-rate":
    case "timeout":
      return error.reason;
    case "in-flight-budget":
      return "provider-rate";
    case "provider-error":
    case "invalid-response":
    case "response-too-large":
    case "data-policy":
    case "provider-input":
      return "provider-error";
    default:
      return null;
  }
}
