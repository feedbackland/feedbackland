import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { getEmbeddedToken, setEmbeddedToken } from "../../lib/auth/client";
import { openSocialPopup, preparePopupFlow } from "../../lib/auth/popup-client";

async function main() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window"),
    originalFetch = globalThis.fetch;
  const storage = new Map<string, string>(),
    listeners = new Set<(event: MessageEvent) => void>();
  let nullHandle = false;
  const opens: string[] = [],
    calls: RequestInit[] = [],
    releases: Array<(response: Response) => void> = [];
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const message = (ticket: string, origin = "https://fixture.invalid") =>
    listeners.forEach((listener) =>
      listener({
        origin,
        data: {
          type: "feedbackland:popup-ready",
          ticket,
          token: "message-must-never-authorize",
        },
      } as MessageEvent),
    );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "https://fixture.invalid" },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      open: (url: string) => {
        opens.push(url);
        if (nullHandle) return null;
        return {
          get closed() {
            throw new Error("popup.closed was read");
          },
        };
      },
      addEventListener: (
        _name: string,
        listener: (event: MessageEvent) => void,
      ) => listeners.add(listener),
      removeEventListener: (
        _name: string,
        listener: (event: MessageEvent) => void,
      ) => listeners.delete(listener),
    },
  });
  globalThis.fetch = async (_input, init) => {
    calls.push(init!);
    return new Promise<Response>((resolve) => releases.push(resolve));
  };
  try {
    const flow = await preparePopupFlow();
    assert.match(flow.ticket, /^[a-f0-9]{32}$/);
    assert.match(flow.secret, /^[a-f0-9]{32}$/);
    assert.equal(
      flow.h,
      createHash("sha256").update(flow.secret).digest("hex"),
    );
    setEmbeddedToken(null);
    const controller = new AbortController();
    const success = openSocialPopup("oidc", flow, "drawer", controller.signal);
    void success.catch(() => {});
    assert.equal(opens.length, 1, "Popup was deferred beyond the click stack");
    assert(!opens[0].includes(flow.secret));
    assert.equal(calls[0].credentials, "omit");
    assert.equal(new Headers(calls[0].headers).get("authorization"), null);
    releases.shift()!(Response.json({ pending: true }, { status: 202 }));
    await tick();
    message("wrong-ticket");
    message(flow.ticket, "https://foreign.invalid");
    await tick();
    assert.equal(calls.length, 1);
    message(flow.ticket);
    await tick();
    assert.equal(calls.length, 2);
    releases.shift()!(Response.json({ pending: true }, { status: 429 }));
    await tick();
    message(flow.ticket);
    await tick();
    assert.equal(calls.length, 3);
    assert.equal(getEmbeddedToken(), null, "A postMessage supplied authority");
    releases.shift()!(Response.json({ token: "signed-embedded-fixture" }));
    await success;
    assert.equal(getEmbeddedToken(), "signed-embedded-fixture");
    assert.equal(listeners.size, 0);

    nullHandle = true;
    const stale = openSocialPopup(
      "oidc",
      await preparePopupFlow(),
      "drawer",
      new AbortController().signal,
    );
    void stale.catch(() => {});
    setEmbeddedToken("new-identity");
    releases.shift()!(Response.json({ token: "old-identity" }));
    await assert.rejects(stale, /session changed/);
    assert.equal(getEmbeddedToken(), "new-identity");
    const abort = new AbortController();
    const cancelled = openSocialPopup(
      "oidc",
      await preparePopupFlow(),
      "drawer",
      abort.signal,
    );
    void cancelled.catch(() => {});
    abort.abort();
    releases.shift()!(Response.json({ token: "cancelled-identity" }));
    await assert.rejects(
      cancelled,
      (error) => error instanceof DOMException && error.name === "AbortError",
    );
    assert.equal(getEmbeddedToken(), "new-identity");
    assert.equal(listeners.size, 0);
    const firstParty = openSocialPopup(
      "oidc",
      await preparePopupFlow(),
      "first-party",
      new AbortController().signal,
    );
    assert.equal(calls.at(-1)?.credentials, "include");
    releases.shift()!(Response.json({ done: true }));
    await firstParty;
    assert.equal(getEmbeddedToken(), "new-identity");
    console.log(
      "Popup client: synchronous open, cookie-free claims, 202/429 polling, origin/ticket hints, abort and identity fencing passed",
    );
  } finally {
    setEmbeddedToken(null);
    globalThis.fetch = originalFetch;
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
