import "server-only";
import { connectionText, connectionChat } from "../ai-request-limits";
import type { OwnedLease } from "../jobs/leases";
import type { Actor } from "../auth/authorization";
import { AiError, EmbeddingWidthError, safeError } from "./errors";
import {
  configuration,
  beginCheck,
  finishConnectionCheck,
  keyCandidate,
  type CheckTicket,
  type Configuration,
  saveConfiguration,
  type Check,
  type CheckIssue,
  type Identity,
} from "./settings-store";
import { callChat, callEmbeddings, readProviderMetadata } from "./client";
import { checkImage, validateConnectionReply } from "./connection-check";
import { deadline } from "./deadline";
import { indexSnapshot } from "./search-index";
import { runtimeState } from "../runtime-state";
import type { Options } from "./defaults";

export function diagnosticIssue(
  error: unknown,
  signal?: AbortSignal,
): CheckIssue {
  const e = safeError(error, signal);
  switch (e.reason) {
    case "STALE_CONFIGURATION":
    case "forbidden":
    case "RESERVATION_EXPIRED":
    case "AI_NOT_CONFIGURED":
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
  return runConnectionCheck(config, ticket, {
    enable: intent === "enable",
    signal,
  });
}
export async function runConnectionCheck(
  config: Configuration,
  ticket: CheckTicket,
  {
    enable = false,
    signal,
    worker,
    capabilities,
    replacementKey,
  }: {
    enable?: boolean;
    signal?: AbortSignal;
    worker?: OwnedLease;
    capabilities?: { chat: boolean; search: boolean };
    replacementKey?: string;
  },
) {
  const result: Check = {
    key: "unknown",
    chat: "untested",
    search: "untested",
    expiresAt: config.check?.expiresAt,
  };
  if (capabilities && config.check) {
    if (!capabilities.chat) {
      result.chat = config.check.chat;
      result.chatIssue = config.check.chatIssue;
    }
    if (!capabilities.search) {
      result.search = config.check.search;
      result.searchIssue = config.check.searchIssue;
      result.actualDimensions = config.check.actualDimensions;
      result.verifiedDimensions = config.check.verifiedDimensions;
    }
  }
  try {
    const key = await readProviderMetadata(
      "key",
      ticket.action?.actor,
      signal,
      ticket,
      worker?.lease,
      undefined,
      config,
    );
    if (Array.isArray(key)) throw new AiError("invalid-response");
    result.key = key.management
      ? "management"
      : key.expired
        ? "expired"
        : "valid";
    result.expiresAt = key.expiresAt;
    result.spendLimit = key.limit;
    result.limitReset = key.limitReset;
    result.remaining = key.remaining;
    if (key.management) result.chatIssue = "management-key";
    else if (key.expired) result.chatIssue = "expired-key";
    else if (key.remaining === 0 && key.limit !== null)
      result.chatIssue = "key-limit";
  } catch (error) {
    result.chatIssue = diagnosticIssue(error, signal);
    if (result.chatIssue === "invalid-key") result.key = "invalid";
  }
  if (!result.chatIssue && (capabilities?.chat ?? true)) {
    try {
      await callChat("check", connectionChat, {
        check: ticket,
        lease: worker?.lease,
        signal,
        content: { config, wall: deadline(config.options.timeoutMs, signal) },
        validateText: validateConnectionReply,
        images: config.options.vision ? [checkImage] : [],
      });
      result.chat = "passed";
    } catch (error) {
      result.chatIssue = diagnosticIssue(error, signal);
    }
  }
  if (result.chatIssue === "invalid-key") result.key = "invalid";
  if (result.chatIssue)
    result.chat = ["budget", "busy"].includes(result.chatIssue)
      ? "untested"
      : "failed";
  if (
    (capabilities?.search ?? true) &&
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
        lease: worker?.lease,
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
  let saved = await finishConnectionCheck(ticket, result, enable, {
    worker,
    signal,
    replacementKey,
  });
  if ((capabilities?.search ?? true) && result.search === "passed") {
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
        checked:
          index.config.check.at + "/" + (index.config.check.sequence ?? ""),
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
  const current = await configuration(signal, true);
  if (
    current.token !== identity.token ||
    current.revision !== identity.revision
  )
    throw new AiError("STALE_CONFIGURATION");
  const config = keyCandidate(current, key);
  const admitted = await beginCheck(
    config,
    { actor, intent: "configure" },
    deadline(config.options.timeoutMs, signal),
  );
  return runConnectionCheck(
    config,
    { ...admitted, candidateDigest: config.keyDigest! },
    { enable: true, signal, replacementKey: key },
  );
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
