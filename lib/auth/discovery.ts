import "server-only";
import { getPool } from "../../db/db";
import { getConfig } from "../config";
import { runtimeState } from "../runtime-state";
import { log, sqlstate } from "../log";
import { smtpEnabled } from "../mail";
import { createAuthInstance, getAuth } from "./server";
import type { OidcMetadata } from "./oidc";

export function oidcConfigured() {
  const config = getConfig();
  return !!(
    config.appUrl?.startsWith("https:") &&
    config.social.oidc.issuer &&
    config.social.oidc.clientId &&
    config.social.oidc.clientSecret
  );
}
function discoveryState() {
  return (runtimeState().authDiscovery ??= {
    epoch: null,
    lastPoll: 0,
    lastAttempt: 0,
    failed: false,
  });
}
async function discoveryDocument(signal: AbortSignal) {
  const issuer = getConfig().social.oidc.issuer!;
  const location = new URL(
    ".well-known/openid-configuration",
    issuer.replace(/\/?$/, "/"),
  );
  if (
    location.protocol !== "https:" ||
    location.username ||
    location.password ||
    location.hash ||
    location.search
  )
    throw new Error("Invalid discovery URL");
  const response = await fetch(location, {
    signal,
    redirect: "error",
    headers: { accept: "application/json" },
  });
  if (!response.ok || !response.body) throw new Error("Discovery unavailable");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 64 * 1024) throw new Error("Discovery document too large");
      parts.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const document: Record<string, unknown> = JSON.parse(
    Buffer.concat(parts).toString("utf8"),
  );
  if (document.issuer !== issuer) throw new Error("Discovery issuer mismatch");
  for (const key of [
    "authorization_endpoint",
    "token_endpoint",
    "jwks_uri",
    "userinfo_endpoint",
    "end_session_endpoint",
  ]) {
    if (
      document[key] === undefined &&
      ["userinfo_endpoint", "end_session_endpoint"].includes(key)
    )
      continue;
    if (typeof document[key] !== "string")
      throw new Error("Incomplete discovery");
    const url = new URL(document[key]);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new Error("Invalid discovery endpoint");
  }
  const allowed = new Set([
    "RS256",
    "RS384",
    "RS512",
    "PS256",
    "PS384",
    "PS512",
    "ES256",
    "ES384",
    "ES512",
    "EdDSA",
  ]);
  const algorithms = document.id_token_signing_alg_values_supported;
  if (
    !Array.isArray(algorithms) ||
    !algorithms.length ||
    algorithms.some((algorithm) => !allowed.has(algorithm))
  )
    throw new Error("Invalid discovery algorithms");
  return document as OidcMetadata;
}
async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
function construct(epoch: string) {
  const state = discoveryState();
  state.controller?.abort();
  const previous = state.pending;
  const controller = new AbortController();
  const build = async () => {
    if (previous) await previous;
    if (state.epoch !== epoch) return;
    state.controller = controller;
    state.lastAttempt = Date.now();
    const deadline = setTimeout(() => controller.abort(), 10_000);
    try {
      const document = await discoveryDocument(controller.signal);
      controller.signal.throwIfAborted();
      const candidate = createAuthInstance(document);
      const context = await abortable(candidate.$context, controller.signal);
      if (!context.socialProviders.some((provider) => provider.id === "oidc"))
        throw new Error("Provider unavailable");
      if (state.epoch !== epoch || controller.signal.aborted) return;
      runtimeState().auth = candidate;
      state.failed = false;
      log("auth.discovery-ready", { name: "oidc" });
    } catch {
      if (state.epoch === epoch) {
        state.failed = true;
        log("auth.discovery-failed", { name: "oidc" }, "warn");
      }
    } finally {
      clearTimeout(deadline);
      if (state.controller === controller) state.controller = undefined;
    }
  };
  const pending = build();
  state.pending = pending;
  void pending.finally(() => {
    if (state.pending === pending) state.pending = undefined;
  });
}
async function pollEpoch(force = false) {
  if (!oidcConfigured()) return;
  const state = discoveryState();
  if (state.poll) return state.poll;
  if (!force && Date.now() - state.lastPoll < 5000) return;
  const poll = async () => {
    state.lastPoll = Date.now();
    let epoch: string;
    try {
      const result = await getPool(true).query<{ discoveryEpoch: string }>(
        'select "discoveryEpoch" from auth_runtime where id=1',
      );
      if (!result.rows[0]) throw new Error("Missing auth runtime");
      epoch = result.rows[0].discoveryEpoch;
    } catch (error) {
      log(
        "auth.discovery-epoch-unavailable",
        { sqlstate: sqlstate(error) },
        "warn",
      );
      return;
    }
    if (
      state.epoch === epoch &&
      !(
        state.failed &&
        !state.pending &&
        Date.now() - state.lastAttempt >= 60_000
      )
    )
      return;
    state.epoch = epoch;
    construct(epoch);
  };
  const pending = poll();
  state.poll = pending;
  try {
    await pending;
  } finally {
    if (state.poll === pending) state.poll = undefined;
  }
}
export async function synchronizeAuthProviders(force = false): Promise<void> {
  await pollEpoch(force);
  const state = discoveryState();
  while (state.pending) await state.pending;
}
export async function startAuthDiscovery() {
  if (!oidcConfigured()) return;
  await synchronizeAuthProviders(true);
  const state = discoveryState();
  if (state.timer) return;
  // Poll independently of construction. A newer epoch aborts an obsolete
  // discovery request and queues one replacement, with no parallel builds.
  state.timer = setInterval(() => {
    void pollEpoch().catch(() =>
      log("auth.discovery-maintenance-failed", {}, "warn"),
    );
  }, 5000);
  state.timer.unref();
}
export async function authCapabilities() {
  await synchronizeAuthProviders();
  const config = getConfig();
  const context = await getAuth().$context;
  const socialProviders = context.socialProviders
    .map((provider) => provider.id)
    .filter((id): id is "google" | "microsoft" | "oidc" =>
      ["google", "microsoft", "oidc"].includes(id),
    );
  return {
    smtp: smtpEnabled(),
    socialProviders,
    oidcLabel: socialProviders.includes("oidc")
      ? config.social.oidc.name
      : null,
  };
}
export async function authStatus() {
  const capabilities = await authCapabilities();
  const config = getConfig();
  const configured = {
    google: !!(
      config.social.google.clientId && config.social.google.clientSecret
    ),
    microsoft: !!(
      config.social.microsoft.clientId && config.social.microsoft.clientSecret
    ),
    oidc: !!(
      config.social.oidc.issuer &&
      config.social.oidc.clientId &&
      config.social.oidc.clientSecret
    ),
  };
  return {
    smtp: capabilities.smtp,
    recoveryEnabled: !!config.recoveryCode,
    appUrl: config.appUrl ?? null,
    providers: (["google", "microsoft", "oidc"] as const).map((id) => ({
      id,
      name:
        id === "oidc"
          ? config.social.oidc.name
          : id === "google"
            ? "Google"
            : "Microsoft",
      enabled: capabilities.socialProviders.includes(id),
      reason: !configured[id]
        ? "not configured"
        : !config.appUrl?.startsWith("https:")
          ? "requires a configured HTTPS app URL"
          : id === "oidc" && discoveryState().failed
            ? capabilities.socialProviders.includes(id)
              ? "retry failed; using the last working discovery"
              : "discovery failed"
            : null,
      callbackUrl: config.appUrl
        ? new URL(`/api/auth/callback/${id}`, config.appUrl).href
        : null,
    })),
  };
}
