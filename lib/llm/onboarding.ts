import "server-only";
import { connectionText, connectionChat } from "../ai-request-limits";
import { z } from "zod";
import type { Actor } from "../auth/authorization";
import { AiError, EmbeddingWidthError, safeError } from "./errors";
import {
  configuration,
  beginCheck,
  finishAdminCheck,
  saveConfiguration,
  type Check,
  type CheckIssue,
  type Identity,
} from "./settings-store";
import { callChat, callEmbeddings, readProviderMetadata } from "./client";
import { deadline } from "./deadline";
import { indexSnapshot } from "./search-index";
import { runtimeState } from "../runtime-state";
import type { Options } from "./defaults";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGNsaGhgwAaYsIoOWgkAMBcBkGHHl6YAAAAASUVORK5CYII=",
  "base64",
);
const checkImage = {
  id: "connection-check",
  contentType: "image/png",
  width: 8,
  height: 8,
  byteSize: png.length,
  load: async () => png,
};
export function diagnosticIssue(
  error: unknown,
  signal?: AbortSignal,
): CheckIssue {
  const e = safeError(error, signal);
  switch (e.reason) {
    case "STALE_CONFIGURATION":
    case "forbidden":
    case "RESERVATION_EXPIRED":
    case "aborted":
      throw e;
    case "provider-auth":
      return "invalid-key";
    case "provider-credit":
      return e.creditDetail ?? "unavailable";
    case "data-policy":
      return "privacy";
    case "provider-rate":
    case "in-flight-budget":
      return "provider-rate";
    case "timeout":
      return "timeout";
    case "AI_PAUSED":
      return "budget";
    case "AI_BUSY":
    case "VISION_BUSY":
      return "busy";
    case "UNSUPPORTED_EMBEDDING_TOKENIZER":
      return "unsupported-model";
    case "invalid-response":
      return e instanceof EmbeddingWidthError
        ? "dimension-mismatch"
        : "invalid-response";
    case "provider-error":
      return e.status === 404
        ? "model-unavailable"
        : e.status === null
          ? "network"
          : "unavailable";
    default:
      return "unavailable";
  }
}
type Intent = "enable" | "configure" | "test-again" | "credit";
export async function checkConnection(
  actor: Actor,
  identity: Identity,
  intent: Intent,
  signal?: AbortSignal,
) {
  const config = await configuration(signal, true);
  if (config.token !== identity.token || config.revision !== identity.revision)
    throw new AiError("STALE_CONFIGURATION");
  const ticket = await beginCheck(
    config,
    { actor, intent: intent === "enable" ? "configure" : intent },
    deadline(config.options.timeoutMs, signal),
  );
  const result: Check = {
    key: "unknown",
    chat: "untested",
    search: "untested",
  };
  try {
    const key = await readProviderMetadata("key", actor, signal, ticket);
    if (Array.isArray(key)) throw new AiError("invalid-response");
    result.key = key.management
      ? "management"
      : key.expired
        ? "expired"
        : "valid";
    result.expiresAt = key.expiresAt;
    result.spendLimit = key.limit;
    result.remaining = key.remaining;
    if (key.management) result.chatIssue = "management-key";
    else if (key.expired) result.chatIssue = "expired-key";
    else if (key.remaining === 0 && key.limit !== null)
      result.chatIssue = "key-limit";
  } catch (error) {
    result.chatIssue = diagnosticIssue(error, signal);
    if (result.chatIssue === "invalid-key") result.key = "invalid";
  }
  if (!result.chatIssue) {
    try {
      await callChat("check", connectionChat, {
        check: ticket,
        signal,
        validateText: (text) => {
          try {
            if (
              z.object({ ok: z.literal(true) }).safeParse(JSON.parse(text))
                .success
            )
              return true;
          } catch {}
          throw new AiError("invalid-response");
        },
        images: config.options.vision ? [checkImage] : [],
      });
      result.chat = "passed";
    } catch (error) {
      result.chatIssue = diagnosticIssue(error, signal);
    }
  }
  if (result.chatIssue)
    result.chat = ["budget", "busy"].includes(result.chatIssue)
      ? "untested"
      : "failed";
  if (
    result.key === "valid" &&
    ![
      "account-credit",
      "key-limit",
      "budget",
      "busy",
      "request-exceeds-balance",
    ].includes(result.chatIssue ?? "") &&
    config.options.embeddingModel !== "none"
  ) {
    try {
      await callEmbeddings("check", [connectionText], {
        check: ticket,
        signal,
        content: { config, wall: deadline(config.options.timeoutMs, signal) },
      });
      result.search = "passed";
      result.verifiedDimensions = config.dimensions;
    } catch (error) {
      result.searchIssue = diagnosticIssue(error, signal);
      result.search = ["budget", "busy"].includes(result.searchIssue)
        ? "untested"
        : "failed";
      if (error instanceof EmbeddingWidthError)
        result.actualDimensions = error.actual;
    }
  }
  let saved = await finishAdminCheck(ticket, result, intent === "enable");
  if (result.search === "passed") {
    const index = await indexSnapshot(true, signal);
    if (
      !index.reason &&
      index.fingerprint &&
      index.config.revision === saved.revision &&
      index.config.keyDigest === config.keyDigest &&
      index.config.check?.sequence === ticket.sequence &&
      index.config.check.search === "passed" &&
      index.config.dimensions === config.dimensions &&
      index.config.options.embeddingModel === config.options.embeddingModel
    ) {
      saved = { token: index.config.token, revision: index.config.revision };
      runtimeState().embeddingProbe = {
        identity: saved.token,
        ready: true,
        reason: "verified",
        attempt: 0,
        next: 0,
        checked: index.config.check.at,
      };
    }
  }
  return { identity: saved, check: result };
}
export async function installKey(
  actor: Actor,
  identity: Identity,
  key: string,
  signal?: AbortSignal,
) {
  const next = await saveConfiguration(actor, identity, {
    apiKey: key,
    stageKey: true,
  });
  return checkConnection(actor, next, "enable", signal);
}

export async function updateAiOptions(
  actor: Actor,
  identity: Identity,
  options: Partial<Options>,
  signal?: AbortSignal,
) {
  const before = await configuration(signal, true);
  if (before.revision !== identity.revision || before.token !== identity.token)
    throw new AiError("STALE_CONFIGURATION");
  let selectedModel;
  if (
    options.model &&
    options.model !== before.options.model &&
    before.configured &&
    before.apiKey
  ) {
    const models = await readProviderMetadata(
      "chatModels",
      actor,
      signal,
      undefined,
      undefined,
      identity,
    ).catch((e: unknown) => {
      if (e instanceof AiError && e.reason === "STALE_CONFIGURATION") throw e;
      return null;
    });
    const selected = Array.isArray(models)
      ? models.find((m) => m.id === options.model)
      : undefined;
    selectedModel = { id: options.model, vision: selected?.vision ?? null };
  }
  const next = await saveConfiguration(actor, identity, {
    options,
    selectedModel,
  });
  const needsCheck = (
    ["model", "embeddingModel", "privacy", "vision"] as const
  ).some((k) => options[k] !== undefined && options[k] !== before.options[k]);
  if (needsCheck && before.enabled !== false && before.apiKey)
    return checkConnection(
      actor,
      next,
      before.configured ? "configure" : "enable",
      signal,
    );
  return { identity: next, check: null };
}
