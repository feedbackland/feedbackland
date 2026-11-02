import assert from "node:assert/strict";
import {
  createSurfaceAuthClient,
  getEmbeddedToken,
  setEmbeddedToken,
} from "../../lib/auth/client";

async function main() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  const values = new Map<string, string>();
  let denied = false;
  const storage = {
    getItem(key: string) {
      if (denied) throw new Error("Storage denied");
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (denied) throw new Error("Storage denied");
      values.set(key, value);
    },
    removeItem(key: string) {
      if (denied) throw new Error("Storage denied");
      values.delete(key);
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "http://fixture.invalid" },
      localStorage: storage,
    },
  });
  const calls: {
    credentials: RequestCredentials | undefined;
    bearer: string | null;
    scope: string | null;
  }[] = [];
  const releases: ((response: Response) => void)[] = [];
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      credentials: init?.credentials,
      bearer: headers.get("authorization"),
      scope: headers.get("x-feedbackland-scope"),
    });
    return new Promise<Response>((resolve) => releases.push(resolve));
  };
  const response = (token: string) =>
    Response.json(null, { headers: { "set-auth-token": token } });
  try {
    setEmbeddedToken("original");
    const embedded = createSurfaceAuthClient("drawer");
    const stale = embedded.getSession();
    while (!releases.length)
      await new Promise<void>((resolve) => setImmediate(resolve));
    setEmbeddedToken(null);
    releases.shift()!(response("original"));
    await stale;
    assert.equal(
      getEmbeddedToken(),
      null,
      "Late refresh resurrected a cleared token",
    );
    assert.equal(calls[0].credentials, "omit");
    assert.equal(calls[0].bearer, "Bearer original");
    assert.equal(calls[0].scope, "embedded");
    const controller = new AbortController();
    const disposable = createSurfaceAuthClient("drawer", controller.signal);
    const disposed = disposable.getSession();
    while (!releases.length)
      await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();
    releases.shift()!(response("late-disposed-token"));
    await disposed;
    assert.equal(
      getEmbeddedToken(),
      null,
      "Disposed surface persisted a late credential",
    );
    setEmbeddedToken("new identity");
    const firstParty = createSurfaceAuthClient("first-party");
    const firstRead = firstParty.getSession();
    while (!releases.length)
      await new Promise<void>((resolve) => setImmediate(resolve));
    releases.shift()!(response("must-not-be-stored"));
    await firstRead;
    assert.equal(getEmbeddedToken(), "new identity");
    assert.equal(calls.at(-1)?.credentials, "include");
    assert.equal(calls.at(-1)?.bearer, null);
    assert.equal(calls.at(-1)?.scope, null);
    values.clear();
    assert.equal(
      getEmbeddedToken(),
      null,
      "Cross-tab deletion resurrected an in-memory token",
    );
    denied = true;
    setEmbeddedToken("memory fallback");
    assert.equal(getEmbeddedToken(), "memory fallback");
    setEmbeddedToken(null);
    assert.equal(getEmbeddedToken(), null);
    console.log(
      "Auth clients: separate transports, stale/aborted reply fencing, cross-tab clearing and denied-storage fallback passed",
    );
  } finally {
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
