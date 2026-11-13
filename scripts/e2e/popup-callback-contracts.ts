import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "../../lib/auth/options";
import { handoffStore } from "../../lib/auth/handoff-store";

export async function popupCallbackContracts(
  deps: Parameters<typeof buildAuthOptions>[0],
) {
  const auth = betterAuth(
    buildAuthOptions({
      ...deps,
      isSetupComplete: async () => true,
      handoff: handoffStore,
      socialProviders: {
        google: { clientId: "fixture-client", clientSecret: "fixture-secret" },
      },
    }),
  );
  const jar = new Map<string, string>();
  const send = async (path: string, body?: unknown) => {
    const response = await auth.handler(
      new Request("https://fixture.invalid/api/auth" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          origin: "https://fixture.invalid",
          "content-type": "application/json",
          cookie: Array.from(jar, ([key, value]) => key + "=" + value).join(
            "; ",
          ),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0],
        separator = pair.indexOf("=");
      const key = pair.slice(0, separator);
      if (/;\s*Max-Age=0(?:;|$)/i.test(cookie)) jar.delete(key);
      else jar.set(key, pair.slice(separator + 1));
    }
    return response;
  };
  const start = async () => {
    const ticket = randomBytes(16).toString("hex"),
      secret = randomBytes(16).toString("hex");
    const callbackURL = "/auth/popup/done?ticket=" + ticket;
    const start = await send("/popup-handoff/start", {
      ticket,
      h: createHash("sha256").update(secret).digest("hex"),
      mode: "embedded",
    });
    assert.equal(start.status, 200);
    const signIn = await send("/sign-in/social", {
      provider: "google",
      callbackURL,
      errorCallbackURL: callbackURL,
    });
    assert.equal(signIn.status, 200);
    const state = new URL((await signIn.json()).url).searchParams.get("state");
    assert(state);
    const header = signIn.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("fl_popup_state_"));
    assert(header, "Sign-in did not issue a flow-specific cookie");
    for (const attribute of [
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Path=/api/auth/callback/google",
      "Max-Age=600",
    ])
      assert(header.toLowerCase().includes(attribute.toLowerCase()), attribute);
    return { ticket, secret, state, cookie: header.split("=", 1)[0] };
  };
  const first = await start(),
    second = await start();
  assert.notEqual(first.cookie, second.cookie);
  const pending = async (flow: typeof first) =>
    assert.equal((await handoffStore.read(flow.ticket))?.state, "pending");
  const callback = async (
    provider: string,
    state?: string,
    expectedTicket?: string,
  ) => {
    const params = new URLSearchParams({ error: "access_denied" });
    if (state) params.set("state", state);
    const response = await send("/callback/" + provider + "?" + params);
    assert.equal(response.status, 302);
    const landing = new URL(
      response.headers.get("location")!,
      "https://fixture.invalid",
    );
    assert.equal(landing.pathname, "/auth/popup/done");
    assert.equal(landing.searchParams.get("ticket"), expectedTicket ?? null);
  };
  await callback("google");
  await callback("google", randomBytes(16).toString("hex"));
  await callback("microsoft", first.state);
  // Even manually transplanting the second signed value under the first
  // cookie name must not give the older callback authority over either flow.
  const firstCookie = jar.get(first.cookie)!;
  jar.set(first.cookie, jar.get(second.cookie)!);
  await callback("google", first.state);
  await pending(first);
  await pending(second);
  jar.set(first.cookie, firstCookie);
  await callback("google", first.state, first.ticket);
  assert.equal(jar.has(first.cookie), false);
  assert(jar.has(second.cookie));
  assert.equal(
    (await handoffStore.read(first.ticket))?.error,
    "state_mismatch",
  );
  await pending(second);
  await callback("google", first.state);
  await pending(second);
  await callback("google", second.state, second.ticket);
  assert.equal(jar.has(second.cookie), false);
  for (const [flow, error] of [
    [first, "state_mismatch"],
    [second, "access_denied"],
  ] as const) {
    const claim = () =>
      send("/popup-handoff/claim", {
        ticket: flow.ticket,
        secret: flow.secret,
      });
    assert.deepEqual(await (await claim()).json(), { error });
    assert.equal((await claim()).status, 404);
  }
}
