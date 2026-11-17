import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { getAppUrl } from "../app-url";
import { getConfig } from "../config";
import { openSecret, sealSecret } from "../secret-box";
import { DomainError } from "../domain-error";
import type { Actor } from "../auth/authorization";
import { getSettingsQuery } from "../../queries/get-settings";
import { connectAdmission, type Identity } from "./settings-store";
import { OPENROUTER_AUTH } from "./constants";
import { exchangeConnectCode } from "./fetch";
import { installKey } from "./onboarding";

const cookie = "feedbackland.openrouter";
const flowSchema = z
  .object({
    mode: z.enum(["redirect", "headless"]),
    nonce: z.string().regex(/^[a-f0-9]{32}$/),
    verifier: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    origin: z.url(),
    expires: z.number().int(),
    session: z.string(),
    token: z.string().regex(/^[a-f0-9]{64}$/),
    revision: z.string().regex(/^\d+$/),
  })
  .strict();
const digest = (text: string) => createHash("sha256").update(text).digest();
type Channel = {
  headers: Headers;
  responseHeaders: Headers;
  signal?: AbortSignal;
};
function channelOrigin(channel: Channel) {
  const origin = getAppUrl(channel.headers).appUrl;
  if (channel.headers.get("origin") !== origin)
    throw new DomainError("FORBIDDEN", "Open Connect in this board’s own tab.");
  return origin;
}
function setCookie(channel: Channel, value: string, seconds: number) {
  const secure = channelOrigin(channel).startsWith("https:") ? " Secure;" : "";
  channel.responseHeaders.append(
    "set-cookie",
    cookie +
      "=" +
      value +
      "; Path=/; HttpOnly; SameSite=Lax;" +
      secure +
      " Max-Age=" +
      seconds,
  );
}
export async function startConnect(
  actor: Actor,
  identity: Identity,
  unlisted: boolean,
  channel: Channel,
) {
  const origin = channelOrigin(channel);
  await connectAdmission(actor, identity);
  const board = await getSettingsQuery(),
    url = new URL(origin);
  const mode =
    !unlisted &&
    (url.hostname === "localhost" ||
      (url.protocol === "https:" && board.allowIndexing))
      ? "redirect"
      : "headless";
  const nonce = randomBytes(16).toString("hex"),
    verifier = randomBytes(32).toString("base64url");
  const flow = {
    ...identity,
    mode,
    nonce,
    verifier,
    session: actor.sessionId,
    origin,
    expires: Date.now() + 3600_000,
  };
  setCookie(
    channel,
    sealSecret(
      JSON.stringify(flow),
      getConfig().authSecret,
      "connect-openrouter:" + actor.userId,
    ),
    3600,
  );
  const auth = new URL(OPENROUTER_AUTH);
  auth.searchParams.set(
    "code_challenge",
    digest(verifier).toString("base64url"),
  );
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set(
    "key_label",
    Array.from("Feedbackland – " + board.platformTitle)
      .slice(0, 100)
      .join(""),
  );
  if (mode === "redirect") {
    auth.searchParams.set(
      "callback_url",
      origin + "/admin/settings/ai/return/" + nonce,
    );
    auth.searchParams.set("state", nonce);
  }
  return { url: auth.href, mode, nonce };
}
export const finishInput = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("redirect"),
      nonce: z.string().regex(/^[a-f0-9]{32}$/),
      state: z.string().regex(/^[a-f0-9]{32}$/),
      code: z.string().min(1).max(1024),
    })
    .strict(),
  z
    .object({
      mode: z.literal("headless"),
      nonce: z.string().regex(/^[a-f0-9]{32}$/),
      code: z.string().min(1).max(1024),
    })
    .strict(),
]);
export async function finishConnect(
  actor: Actor,
  input: z.infer<typeof finishInput>,
  channel: Channel,
) {
  const origin = channelOrigin(channel);
  const raw = channel.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(cookie + "="));
  const value =
    raw?.length === 1
      ? openSecret(
          raw[0].slice(cookie.length + 1),
          getConfig().authSecret,
          "connect-openrouter:" + actor.userId,
        )
      : null;
  let flow: z.infer<typeof flowSchema> | undefined;
  try {
    flow = flowSchema.safeParse(JSON.parse(value ?? "null")).data;
  } catch {}
  if (
    !flow ||
    flow.session !== actor.sessionId ||
    flow.origin !== origin ||
    flow.expires <= Date.now() ||
    flow.mode !== input.mode ||
    flow.nonce !== input.nonce ||
    (input.mode === "redirect" && input.state !== flow.nonce) ||
    !/^[!-~]+$/.test(input.code)
  )
    throw new DomainError(
      "BAD_REQUEST",
      "That connection timed out. Start Connect OpenRouter again.",
    );
  setCookie(channel, "", 0);
  if (
    !(await connectAdmission(
      actor,
      flow,
      digest(flow.verifier).toString("hex"),
    ))
  )
    return { repeated: true };
  const timeout = AbortSignal.timeout(15000),
    signal = channel.signal
      ? AbortSignal.any([timeout, channel.signal])
      : timeout;
  let key: string;
  try {
    key = await exchangeConnectCode(input.code, flow.verifier, signal);
  } catch {
    throw new DomainError(
      "BAD_REQUEST",
      "OpenRouter could not complete this connection. Start Connect OpenRouter again.",
    );
  }
  await installKey(actor, flow, key, channel.signal);
  return { repeated: false };
}
