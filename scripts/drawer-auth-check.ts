import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  readdir,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
  type Route,
} from "playwright";
import type { ViteDevServer } from "vite";
import { command, eventually, toolEnvironment } from "./e2e/run";

const sandbox =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
const denied = "frame-ancestors 'none'";
let diagnosticDirectory = "";
const pageMessages = new WeakMap<Page, string[]>();
function instrumentErrors(page: Page) {
  const messages: string[] = [];
  pageMessages.set(page, messages);
  page.on("pageerror", (error) => messages.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") messages.push(message.text());
  });
  page.on("request", (request) => {
    if (request.headers().rsc || request.isNavigationRequest())
      messages.push(`REQUEST ${request.method()} ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.request().headers().rsc)
      messages.push(`RSC ${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) =>
    messages.push(`FAILED ${request.url()} ${request.failure()?.errorText}`),
  );
}
async function captureFailure(page: Page, name: string) {
  try {
    await page.screenshot({
      path: resolve(diagnosticDirectory, `failure-${name}.png`),
    });
    await writeFile(
      resolve(diagnosticDirectory, `failure-${name}.json`),
      JSON.stringify(
        {
          messages: pageMessages.get(page),
          frames: await Promise.all(
            page.frames().map(async (frame) => ({
              url: frame.url(),
              html: await frame.locator("body").innerHTML(),
            })),
          ),
        },
        null,
        2,
      ),
    );
  } catch {
    /* Preserve the primary assertion if the page has already closed. */
  }
}
type InstrumentedWindow = Window & {
  next: { router: { push: (url: string) => void } };
  surfaceCalls: Array<{ url: string; credentials: string; aborted: boolean }>;
};
async function observe(context: BrowserContext) {
  await context.addInitScript(() => {
    const target = window as unknown as InstrumentedWindow;
    target.surfaceCalls = [];
    const original = window.fetch;
    window.fetch = (input, options) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const record = {
        url,
        credentials: options?.credentials ?? "same-origin",
        aborted: false,
      };
      target.surfaceCalls.push(record);
      options?.signal?.addEventListener("abort", () => {
        record.aborted = true;
      });
      return original(input, options);
    };
  });
}
async function drawer(page: Page, host: string, board: string) {
  await page.goto(`${host}/?board=${encodeURIComponent(board)}`);
  await page
    .getByRole("button", { name: "Open feedback", exact: true })
    .click();
  // A locator inside an iframe checks its own layout, not the enclosing
  // drawer's transform. Wait for that real transition before sending input.
  await page
    .getByRole("dialog", { name: "Share your feedback", exact: true })
    .evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
  const element = page.locator('iframe[title="Share your feedback"]');
  await element.waitFor();
  // The host shimmer can still cover an already-hydrated iframe. Verify the
  // iframe itself receives pointer input instead of clicking through a loader.
  await eventually(
    () =>
      element.evaluate((iframe) => {
        const box = iframe.getBoundingClientRect();
        return (
          document.elementFromPoint(
            box.left + box.width / 2,
            box.top + Math.min(100, box.height / 2),
          ) === iframe
        );
      }),
    Boolean,
    20_000,
  );
  assert.equal(await element.getAttribute("sandbox"), sandbox);
  const handle = await element.elementHandle();
  assert(handle);
  const actual = await handle.contentFrame();
  assert(actual);
  await actual
    .getByRole("textbox", { name: "Your feedback", exact: true })
    .waitFor();
  return actual;
}
async function contracts(base: string, post: string) {
  for (const [path, policy] of [
    ["/", denied],
    ["/?embed=drawer", "frame-ancestors *"],
    ["/?embed=x&embed=drawer", "frame-ancestors *"],
    ["/?embed=drawer&embed=x", "frame-ancestors *"],
    [`/${post}?embed=drawer`, "frame-ancestors *"],
    ["/admin?embed=drawer", denied],
    ["/api/settings?embed=drawer", denied],
    [
      `/api/images/${post}?embed=drawer`,
      "default-src 'none'; sandbox; frame-ancestors 'none'",
    ],
    ...[
      "/admin",
      "/admin/settings",
      "/setup",
      "/recover",
      "/reset-password",
      "/auth/popup",
    ].map((path) => [path, denied]),
    [
      `/api/images/${post}`,
      "default-src 'none'; sandbox; frame-ancestors 'none'",
    ],
  ]) {
    const response = await fetch(base + path);
    if (["/setup", "/recover", "/reset-password", "/auth/popup"].includes(path))
      assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("content-security-policy"), policy, path);
    if (path.startsWith("/api/images/")) {
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("content-disposition"), "inline");
    }
  }
  assert.equal((await fetch(`${base}/robots.txt`)).status, 404);
  assert.equal((await fetch(`${base}/definitely-not-a-uuid`)).status, 404);
  const document = await (await fetch(base)).text();
  assert.match(document, /name="robots" content="index,\s*follow"/);
  assert.match(
    await (await fetch(`${base}/?embed=drawer`)).text(),
    /name="robots" content="noindex,\s*nofollow"/,
  );
  assert.equal((await fetch(`${base}/icon.svg`)).status, 200);
  assert(document.includes("/icon.svg"));
  assert.match(
    await (await fetch(`${base}/admin`)).text(),
    /name="robots" content="noindex,\s*nofollow"/,
  );
}

async function navigation(
  browser: Browser,
  host: string,
  base: string,
  post: string,
  mode: "reload" | "mismatch" | "502",
  artifacts: string,
) {
  const context = await browser.newContext();
  await observe(context);
  const page = await context.newPage();
  instrumentErrors(page);
  let injected = 0,
    documents = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.url().startsWith(base))
      documents++;
  });
  if (mode !== "reload")
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === `/${post}` && request.headers().rsc === "1") {
        injected++;
        if (mode === "502")
          await route.fulfill({ status: 502, body: "fixture restart" });
        else {
          const response = await route.fetch();
          await route.fulfill({
            response,
            headers: {
              ...response.headers(),
              "x-nextjs-deployment-id": "fixture-mismatch",
            },
          });
        }
      } else await route.continue();
    });
  try {
    const frame = await drawer(page, host, base);
    const before = documents;
    const target = frame
      .locator(`a[href^="/${post}?"]`)
      .getByRole("heading", { name: "P03 navigation post.", exact: true });
    await target.click();
    await frame.waitForURL((url) => url.pathname === `/${post}`);
    await frame
      .getByRole("heading", {
        name: "P03 navigation post.",
        exact: true,
        level: 1,
      })
      .waitFor();
    assert.equal(new URL(frame.url()).searchParams.get("embed"), "drawer");
    assert(
      ["dark", "light"].includes(
        new URL(frame.url()).searchParams.get("mode") ?? "",
      ),
    );
    if (mode === "reload") {
      await Promise.all([
        frame.waitForNavigation({ waitUntil: "load" }),
        frame.evaluate(() => window.location.reload()),
      ]);
      await frame
        .getByRole("heading", {
          name: "P03 navigation post.",
          exact: true,
          level: 1,
        })
        .waitFor();
    } else {
      assert(injected > 0, "RSC fault was not exercised");
      assert(documents > before, "RSC fault did not trigger document recovery");
    }
    assert.equal(
      await frame.getByRole("button", { name: "Toggle theme" }).count(),
      0,
    );
    assert.equal(
      await frame.getByRole("link", { name: "Admin Panel" }).count(),
      0,
    );
    const anchor = frame.getByRole("link", { name: "User link", exact: true });
    assert.equal(await anchor.getAttribute("target"), "_blank");
    assert.equal(
      await anchor.getAttribute("rel"),
      "noopener noreferrer nofollow",
    );
    const status = frame.getByText("planned fixed inset-0", { exact: true });
    await status.waitFor();
    assert.equal(await status.getAttribute("class"), null);
    await page.screenshot({ path: resolve(artifacts, `drawer-${mode}.png`) });
    if (mode === "reload") {
      await frame.getByRole("button", { name: "Go back", exact: true }).click();
      await frame.waitForURL((url) => url.pathname === "/");
      assert.equal(new URL(frame.url()).searchParams.get("embed"), "drawer");
      assert(new URL(frame.url()).searchParams.has("mode"));
      await frame.evaluate(() => window.history.back());
      await frame.waitForURL((url) => url.pathname === `/${post}`);
      await frame.evaluate(() => window.history.forward());
      await frame.waitForURL((url) => url.pathname === "/");
      assert.equal(new URL(frame.url()).searchParams.get("embed"), "drawer");
    }
    return { mode, injected, recoveredDocuments: documents };
  } catch (error) {
    await captureFailure(page, `navigation-${mode}`);
    throw error;
  } finally {
    await context.close();
  }
}

async function isolation(
  browser: Browser,
  host: string,
  base: string,
  bypass: boolean,
) {
  const context = await browser.newContext();
  const marker = "p03-private-cookie-marker";
  await context.addCookies([
    { name: "p03-sentinel", value: marker, url: base, sameSite: "Lax" },
  ]);
  await observe(context);
  const page = await context.newPage();
  const scriptRequests: Array<{ url: string; cookie: boolean }> = [];
  instrumentErrors(page);
  let documentCookie = "",
    postReads = 0;
  const observations: Promise<void>[] = [];
  page.on("request", (request) => {
    observations.push(
      (async () => {
        const headers = await request.allHeaders();
        if (request.isNavigationRequest() && request.url().startsWith(base))
          documentCookie = headers.cookie ?? "";
        if (
          request.url().startsWith(base) &&
          /\/api\/(trpc|auth|images)|\/auth\/popup.*claim/.test(request.url())
        ) {
          scriptRequests.push({
            url: request.url(),
            cookie: !!headers.cookie,
          });
          if (request.url().includes("getFeedbackPost")) postReads++;
        }
      })(),
    );
  });
  try {
    const html = await (
      await fetch(`${base}/?embed=drawer`, {
        headers: { cookie: `p03-sentinel=${marker}` },
      })
    ).text();
    assert.doesNotMatch(html, new RegExp(marker));
    if (bypass) assert.match(html, /data-surface="unresolved"/);
    const frame = await drawer(page, host, base);
    await frame
      .getByRole("link")
      .filter({ hasText: "P03 navigation post." })
      .waitFor();
    await Promise.all(observations);
    // A same-site document may carry the sentinel; script API requests must not.
    if (host.includes("localhost"))
      assert(
        documentCookie.includes(marker),
        "No ambient-cookie challenge reached document navigation",
      );
    assert(scriptRequests.length > 0, "No API subrequests were observed");
    assert(
      scriptRequests.every((request) => !request.cookie),
      JSON.stringify(scriptRequests),
    );
    const calls = await frame.evaluate(() =>
      (window as unknown as InstrumentedWindow).surfaceCalls.filter((call) =>
        call.url.includes("/api/"),
      ),
    );
    assert(calls.length > 0);
    assert(calls.every((call) => call.credentials === "omit"));
    const variants = bypass
      ? ["embed=x&embed=drawer&mode=dark"]
      : ["embed=x&embed=drawer&mode=dark", "embed=drawer&embed=x&mode=dark"];
    for (const query of variants) {
      await frame.goto(`${base}/?${query}`);
      await frame
        .getByRole("textbox", { name: "Your feedback", exact: true })
        .waitFor();
      assert.equal(
        await frame.getByRole("button", { name: "Toggle theme" }).count(),
        0,
      );
    }
    await frame
      .getByRole("link")
      .filter({ hasText: "P03 navigation post." })
      .waitFor();
    const fresh = await fetch(`${base}/api/feedback/create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "P03 cancellation post." }),
    });
    assert.equal(fresh.status, 201);
    const cancellationPost: string = (await fresh.json()).id;
    let release: (() => void) | undefined;
    let pending = false;
    const hold = async (route: Route) => {
      const paths =
        decodeURIComponent(new URL(route.request().url()).pathname)
          .split("/")
          .at(-1)
          ?.split(",") ?? [];
      if (paths.includes("getFeedbackPost") && !pending) {
        pending = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        try {
          await route.continue();
        } catch {
          /* The asserted cancellation aborted this request. */
        }
      } else await route.continue();
    };
    await context.route("**/api/trpc/**", hold);
    await frame.evaluate(
      (id) =>
        (window as unknown as InstrumentedWindow).next.router.push(
          `/${id}?embed=drawer&mode=dark`,
        ),
      cancellationPost,
    );
    await frame.waitForURL((url) => url.pathname === `/${cancellationPost}`);
    await eventually(async () => pending, Boolean);
    await Promise.all(observations);
    const before = postReads;
    await frame.evaluate(() => {
      const current = new URL(window.location.href);
      current.searchParams.delete("embed");
      window.history.pushState(null, "", current);
    });
    await frame
      .getByRole("alert")
      .filter({ hasText: "Open this page in its own tab" })
      .waitFor();
    await eventually(
      () =>
        frame.evaluate(() =>
          (window as unknown as InstrumentedWindow).surfaceCalls.some(
            (call) =>
              new URL(call.url, window.location.href).pathname
                .split("/")
                .at(-1)
                ?.split(",")
                .includes("getFeedbackPost") && call.aborted,
          ),
        ),
      Boolean,
    );
    release?.();
    await context.unroute("**/api/trpc/**", hold);
    await frame.evaluate(() => {
      const current = new URL(window.location.href);
      current.searchParams.set("embed", "drawer");
      window.history.pushState(null, "", current);
    });
    await frame
      .getByRole("heading", {
        name: "P03 cancellation post.",
        exact: true,
        level: 1,
      })
      .waitFor();
    await eventually(
      async () => postReads,
      (count) => count > before,
    );
    await frame.evaluate(() =>
      (window as unknown as InstrumentedWindow).next.router.push("/admin"),
    );
    await frame
      .getByRole("alert")
      .filter({ hasText: "Open this page in its own tab" })
      .waitFor();
    assert.equal(await frame.getByRole("tab", { name: "Settings" }).count(), 0);
    await frame.evaluate(
      (id) =>
        (window as unknown as InstrumentedWindow).next.router.push(
          `/${id}?embed=drawer&mode=dark`,
        ),
      cancellationPost,
    );
    await frame
      .getByRole("heading", {
        name: "P03 cancellation post.",
        exact: true,
        level: 1,
      })
      .waitFor();
    await Promise.all(observations);
    assert(scriptRequests.every((request) => !request.cookie));
    return {
      bypass,
      site: host.includes("localhost") ? "same-site" : "cross-site",
      ambientDocumentCookieObserved: documentCookie.includes(marker),
      firstApiRequests: scriptRequests.length,
      cookieFree: true,
      freshCacheAfterRemount: true,
      pendingRequestAborted: true,
      framedAdmin: "refused",
    };
  } catch (error) {
    await captureFailure(
      page,
      `isolation-${bypass ? "bypass" : "normal"}-${host.includes("localhost") ? "same-site" : "cross-site"}`,
    );
    throw error;
  } finally {
    await context.close();
  }
}

async function clipboardAndErrors(browser: Browser, host: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let documents = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest()) documents++;
  });
  try {
    const insecure = host.replace("localhost", "p03-http.test");
    await page.goto(`${insecure}/?fixture=copy`);
    assert.equal(await page.evaluate(() => window.isSecureContext), false);
    assert.equal(
      await page
        .getByRole("button", { name: "Copy image to clipboard", exact: true })
        .count(),
      0,
    );
    await page.getByRole("button", { name: "Copy fixture text" }).click();
    await eventually(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { fixtureResult?: boolean }).fixtureResult,
        ),
      (value) => value !== undefined,
    );
    assert.equal(
      await page.evaluate(
        () => (window as unknown as { fixtureResult?: boolean }).fixtureResult,
      ),
      true,
      "Plain-HTTP copy did not complete through the native fallback",
    );
    assert.equal(
      await page.evaluate(
        () =>
          (window as unknown as { fixtureImageResult?: boolean })
            .fixtureImageResult,
      ),
      false,
    );
    await page.addInitScript(() => {
      document.execCommand = () => false;
    });
    await page.reload();
    await page.getByRole("button", { name: "Copy fixture text" }).click();
    const fallback = page.getByRole("dialog", { name: "Copy text manually" });
    await fallback.waitFor();
    const field = fallback.getByRole("textbox", { name: "Text to copy" });
    assert.equal(await field.inputValue(), "Fixture text to copy");
    assert.equal(await field.getAttribute("readonly"), "");
    assert.equal(
      await field.evaluate(
        (element: HTMLTextAreaElement) =>
          element.selectionEnd - element.selectionStart,
      ),
      "Fixture text to copy".length,
    );
    await fallback.getByRole("button", { name: "Close", exact: true }).click();
    await page.goto(`${host}/error-route?fixture=error&embed=drawer&mode=dark`);
    const beforeReload = documents;
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await page
      .getByRole("heading", { name: "Feedback could not load" })
      .waitFor();
    assert.equal(new URL(page.url()).searchParams.get("mode"), "dark");
    assert(documents > beforeReload);
    await page.getByRole("button", { name: "Back to feedback" }).click();
    await page
      .getByRole("heading", { name: "Feedback could not load" })
      .waitFor();
    assert.equal(new URL(page.url()).searchParams.get("embed"), "drawer");
    assert.equal(new URL(page.url()).pathname, "/");
    return {
      plainHttp: "checked",
      manualFallback: "selected read-only field",
      errorQuery: "preserved",
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const { values } = parseArgs({
    options: { image: { type: "string" }, artifacts: { type: "string" } },
  });
  assert(values.image && values.artifacts, "Supply --image and --artifacts");
  assert(
    (await readdir(".")).every(
      (file) => !file.startsWith(".env") || file === ".env.example",
    ),
  );
  const docker = (...args: string[]) =>
    command("docker", args, { timeout: 180_000 });
  const inspect = async (name: string) =>
    JSON.parse(await docker("inspect", name))[0];
  const image = JSON.parse(await docker("image", "inspect", values.image))[0]
    .Id as string;
  const project = `p03-browser-${randomUUID().slice(0, 8)}`;
  const directory = await mkdtemp(join(tmpdir(), `${project}-`));
  const containers: string[] = [],
    tags: string[] = [];
  let network = false,
    browser: Browser | undefined,
    host: ViteDevServer | undefined;
  let primary: unknown;
  let output: Record<string, unknown> | undefined;
  await mkdir(values.artifacts, { recursive: true });
  diagnosticDirectory = resolve(values.artifacts);
  try {
    await docker("network", "create", project);
    network = true;
    const database = `${project}-db`;
    containers.push(database);
    await docker(
      "run",
      "-d",
      "--name",
      database,
      "--network",
      project,
      "--network-alias",
      "db",
      "--tmpfs",
      "/var/lib/postgresql:size=512m",
      "-e",
      "POSTGRES_PASSWORD=fixture-only",
      "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11",
    );
    await eventually(
      () => docker("exec", database, "pg_isready", "-U", "postgres"),
      (text) => text.includes("accepting connections"),
    );
    const databaseState = await inspect(database);
    const databaseMounts = databaseState.Mounts as Array<{
      Type: string;
      Destination: string;
    }>;
    assert.equal(
      databaseState.HostConfig.Tmpfs["/var/lib/postgresql"],
      "size=512m",
    );
    assert.equal(
      await docker(
        "exec",
        database,
        "stat",
        "-f",
        "-c",
        "%T",
        "/var/lib/postgresql",
      ),
      "tmpfs",
    );
    assert(databaseMounts.every((mount) => mount.Type !== "volume"));
    const start = async (name: string, target: string) => {
      containers.push(name);
      await docker(
        "run",
        "-d",
        "--name",
        name,
        "--network",
        project,
        "-p",
        "127.0.0.1::3000",
        "--read-only",
        "--tmpfs",
        "/tmp:size=64m",
        "--tmpfs",
        "/app/.next/cache:size=64m",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges:true",
        "-e",
        "DATABASE_URL=postgres://postgres:fixture-only@db:5432/postgres",
        target,
      );
      const port = (await inspect(name)).NetworkSettings.Ports["3000/tcp"][0]
        .HostPort;
      const base = `http://localhost:${port}`;
      await eventually(
        () => fetch(`${base}/api/health`).then((response) => response.status),
        (status) => status === 200,
        100_000,
      );
      return base;
    };
    const base = await start(`${project}-normal`, image);
    const response = await fetch(`${base}/api/feedback/create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        description:
          '<p>P03 navigation post.</p><span data-type="status" data-label="planned fixed inset-0">old</span><p><a href="https://example.invalid/fixture">User link</a></p>',
      }),
    });
    assert.equal(response.status, 201);
    const { id: post } = await response.json();
    await contracts(base, post);
    await docker(
      "exec",
      database,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      'update settings set "allowIndexing"=false, revision=revision+1 where id=1',
    );
    assert.match(
      await (await fetch(base)).text(),
      /name="robots" content="noindex,\s*nofollow"/,
    );
    await docker(
      "exec",
      database,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      'update settings set "allowIndexing"=true, revision=revision+1 where id=1',
    );
    // Deliberately fault the generated proxy registration in a derived fixture,
    // not the production source or production image. This models absent proxy.
    const alias = `feedbackland:${project}-base`,
      bypassTag = `feedbackland:${project}-bypass`;
    await docker("tag", image, alias);
    tags.push(alias);
    const patch =
      "const fs=require('fs');const p='.next/server/functions-config-manifest.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(!j.functions['/_middleware'])throw Error('Missing proxy registration');delete j.functions['/_middleware'];fs.writeFileSync(p,JSON.stringify(j));";
    await writeFile(
      join(directory, "Dockerfile"),
      `FROM ${alias}\nUSER root\nRUN ${JSON.stringify(["node", "-e", patch])}\nUSER node\n`,
    );
    await docker("build", "-t", bypassTag, directory);
    tags.push(bypassTag);
    const bypassImage = JSON.parse(
      await docker("image", "inspect", bypassTag),
    )[0].Id;
    const bypass = await start(`${project}-bypass`, bypassTag);
    assert.equal(
      (await fetch(`${bypass}/?embed=drawer&embed=x`)).headers.get(
        "content-security-policy",
      ),
      denied,
      "An absent proxy must preserve the configured framing denial",
    );
    await writeFile(
      join(directory, "index.html"),
      '<!doctype html><html><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>',
    );
    await writeFile(
      join(directory, "entry.js"),
      await readFile("ci/fixtures/drawer-host.js", "utf8"),
    );
    const { createServer } = await import("vite");
    host = await createServer({
      configFile: false,
      root: directory,
      logLevel: "error",
      resolve: {
        alias: {
          "feedbackland-react": resolve(
            "feedbackland-react/dist/feedbackland-react.js",
          ),
          "fixture-copy": resolve("lib/copy-text.ts"),
          "fixture-error": resolve("app/global-error.tsx"),
          "fixture-image-actions": resolve(
            "components/ui/minimal-tiptap/extensions/image/components/image-actions.tsx",
          ),
          "fixture-tooltip": resolve("components/ui/tooltip.tsx"),
          "@": resolve("."),
          react: resolve("node_modules/react"),
          "react-dom": resolve("node_modules/react-dom"),
        },
        dedupe: ["react", "react-dom"],
      },
      server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: true,
        allowedHosts: ["p03-http.test"],
        fs: { allow: [directory, resolve(".")] },
      },
    });
    await host.listen();
    const address = host.httpServer?.address();
    assert(address && typeof address !== "string");
    const sameSite = `http://localhost:${address.port}`,
      crossSite = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({
      args: ["--host-resolver-rules=MAP p03-http.test 127.0.0.1"],
      env: Object.fromEntries(
        Object.entries(toolEnvironment()).filter(
          (pair): pair is [string, string] => typeof pair[1] === "string",
        ),
      ),
    });
    const navigationRows = [];
    assert.match(
      await (await fetch(`${bypass}/?embed=drawer`)).text(),
      /name="robots" content="noindex,\s*nofollow"/,
      "Missing proxy hints must not advertise an indexable drawer",
    );
    for (const mode of ["reload", "mismatch", "502"] as const)
      navigationRows.push(
        await navigation(
          browser,
          crossSite,
          base,
          post,
          mode,
          values.artifacts,
        ),
      );
    const isolationRows = [];
    for (const [target, absent] of [
      [base, false],
      [bypass, true],
    ] as const)
      for (const origin of [sameSite, crossSite])
        isolationRows.push(await isolation(browser, origin, target, absent));
    const clipboard = await clipboardAndErrors(browser, sameSite);
    output = {
      image,
      proxyBypassFixture: {
        image: bypassImage,
        change: "generated proxy registration removed",
        productionBase: image,
      },
      engine: "chromium",
      headers: "passed",
      metadata:
        "indexing setting, private/drawer noindex and neutral icon passed",
      navigation: navigationRows,
      isolation: isolationRows,
      clipboard,
    };
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    const failures: unknown[] = [];
    for (const action of [
      () => browser?.close(),
      () => host?.close(),
      ...containers
        .reverse()
        .map((name) => () => docker("rm", "--volumes", "-f", name)),
      ...(network ? [() => docker("network", "rm", project)] : []),
      ...tags.reverse().map((tag) => () => docker("image", "rm", tag)),
      async () => {
        assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
        await rm(directory, { recursive: true, force: true });
      },
    ]) {
      try {
        await action();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw new AggregateError(
        [...(primary ? [primary] : []), ...failures],
        "Surface checks/cleanup failed",
      );
  }
  assert(output);
  output.cleanup =
    "owned containers, network, fixture tags and temporary directory removed";
  await writeFile(
    resolve(values.artifacts, "surfaces.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(JSON.stringify(output));
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
