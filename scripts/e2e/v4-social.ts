import assert from "node:assert/strict";
import { createServer as createSocketServer } from "node:net";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import {
  chromium,
  firefox,
  webkit,
  request as apiRequest,
  type Browser,
  type BrowserContext,
  type Frame,
  type Page,
} from "playwright";
import { command, eventually, toolEnvironment } from "./run";
import { submitSetup, fixturePassword } from "./setup-browser";
import { frameOn, signIn } from "./v3-auth";
import { createAuthWidgetHost } from "./widget-host";
import { createHelmetHost } from "../../ci/helmet-host";
import { createOidcMock } from "../../ci/oidc-mock";
import {
  mailContracts,
  passwordAccount,
  recoverForm,
  resetForm,
} from "./social-recovery-browser";

type Check = (name: string, action: () => Promise<unknown>) => Promise<void>;
const pgImage =
  "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11";
const caddyImage =
  "caddy@sha256:e70b164da81ef698b3ad19af799ea6086ce6d9e48ed4079eb9fe26f6fbf14ee5";
const mailpitImage =
  "axllent/mailpit@sha256:9b3a463be15354c0f0eba91697d80e3e0d8a5623ef0e627cacc836bc17fd5231";
async function port() {
  const socket = createSocketServer();
  await new Promise<void>((yes, no) => {
    socket.once("error", no);
    socket.listen(0, "127.0.0.1", yes);
  });
  const address = socket.address();
  assert(address && typeof address !== "string");
  await new Promise<void>((yes, no) =>
    socket.close((error) => (error ? no(error) : yes())),
  );
  return address.port;
}
function sanitizedUrl(raw: string) {
  const url = new URL(raw);
  url.username = "";
  url.password = "";
  url.pathname = url.pathname.replace(
    /(\/api\/auth\/reset-password\/)[^/]+/,
    "$1redacted",
  );
  for (const key of url.searchParams.keys())
    if (!["mode", "embed"].includes(key)) url.searchParams.set(key, "redacted");
  return url.href;
}
function sanitizedFailure(error: unknown) {
  const raw =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  return new Error(
    raw.replace(/https?:\/\/[^\s"'<>]+/g, (value) => {
      try {
        return sanitizedUrl(value);
      } catch {
        return "redacted-url";
      }
    }),
  );
}
async function diagnose(page: Page, path: string) {
  await page.screenshot({ path: path + ".png" }).catch(() => {});
  await writeFile(
    path + ".json",
    JSON.stringify(
      {
        frames: await Promise.all(
          page.frames().map(async (frame) => ({
            url: sanitizedUrl(frame.url()),
            text: await frame
              .locator("body")
              .innerText()
              .catch(() => "closed"),
          })),
        ),
      },
      null,
      2,
    ),
  );
}
async function rpc(
  context: BrowserContext,
  base: string,
  name: string,
  input: unknown,
  expected = 200,
  headers: Record<string, string> = {},
) {
  const response = await context.request.post(base + "/api/trpc/" + name, {
    headers: {
      "content-type": "application/json",
      origin: base,
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    data: { json: input },
  });
  assert.equal(
    response.status(),
    expected,
    `${name} returned ${response.status()}`,
  );
  const body = await response.json();
  return body.result?.data?.json;
}
async function social(
  page: Page,
  target: Page | Frame,
  email: string,
  options: {
    error?: string;
    deny?: boolean;
    badState?: boolean;
    noOpener?: boolean;
    beforeApprove?: (ticket: string) => Promise<void>;
    expired?: boolean;
  } = {},
) {
  await target
    .getByRole("button", { name: /Sign in to manage feedback|^Sign in$/ })
    .first()
    .click();
  // A COOP-isolated tab may have no opener by the time Playwright sees it.
  // The context observes the new tab even when the opener emits no popup event.
  const popupEvent = page.context().waitForEvent("page");
  void popupEvent.catch(() => {});
  await target
    .getByRole("button", { name: "Continue with Fixture SSO", exact: true })
    .click();
  const popup = await popupEvent;
  const responses: Array<{
    path: string;
    status: number;
    code: unknown;
    message: unknown;
  }> = [];
  const diagnostics: Promise<void>[] = [];
  popup.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (
      path === "/api/auth/sign-in/social" ||
      path === "/api/auth/popup-handoff/start"
    )
      diagnostics.push(
        response
          .json()
          .then((body) => {
            responses.push({
              path,
              status: response.status(),
              code: body.code,
              message: body.message,
            });
          })
          .catch(() => {}),
      );
  });
  await popup.getByRole("heading", { name: /Sign in to .*\?/ }).waitFor();
  const ticket = new URL(popup.url()).searchParams.get("ticket")!;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = popup.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/sign-in/social",
    );
    void result.catch(() => {});
    await popup.getByRole("button", { name: "Continue", exact: true }).click();
    const response = await result;
    if (response.status() !== 429) break;
    const seconds = Number(
      response.headers()["retry-after"] ?? response.headers()["x-retry-after"],
    );
    assert(
      Number.isFinite(seconds) && seconds > 0 && seconds <= 10,
      "Unexpected social throttle deadline",
    );
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 100));
  }
  try {
    await popup
      .getByRole("heading", { name: "Fixture identity provider", exact: true })
      .waitFor();
  } catch (error) {
    await Promise.all(diagnostics);
    const detail = {
      url: sanitizedUrl(popup.url()),
      text: await popup
        .locator("body")
        .innerText()
        .catch(() => "closed"),
    };
    throw new Error(
      "Provider navigation failed: " + JSON.stringify({ ...detail, responses }),
      {
        cause: error,
      },
    );
  }
  if (options.noOpener)
    assert.equal(
      await popup.evaluate(() => window.opener),
      null,
      "COOP fixture did not sever opener",
    );
  await popup.getByLabel("Email", { exact: true }).fill(email);
  await options.beforeApprove?.(ticket);
  const closed = options.expired ? popup.waitForEvent("close") : undefined;
  void closed?.catch(() => {});
  await popup
    .getByRole("button", {
      name: options.deny
        ? "Deny access"
        : options.badState
          ? "Break state"
          : "Allow access",
      exact: true,
    })
    .click();
  if (closed) {
    await closed;
    await target
      .getByRole("button", { name: "Cancel sign-in", exact: true })
      .click();
    await target
      .getByRole("alert")
      .filter({ hasText: "Sign-in cancelled" })
      .waitFor();
    return popup;
  }
  if (options.error)
    await target
      .getByRole("alert")
      .filter({ hasText: options.error })
      .waitFor();
  else {
    await target.getByRole("dialog").waitFor({ state: "hidden" });
    await target
      .getByText(
        target === page
          ? "Posting as Provider visitor."
          : "Signed in as Provider visitor",
        { exact: true },
      )
      .waitFor();
  }
  return popup;
}
async function socialBrowser(
  browser: Browser,
  base: string,
  ordinaryHost: string,
  helmetHost: string,
  mock: Awaited<ReturnType<typeof createOidcMock>>,
  pool: Pool,
  artifacts: string,
) {
  const engine = browser.browserType().name();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { "x-fixture-replica": "B" },
  });
  const page = await context.newPage();
  const browserErrors: string[] = [];
  let webkitFrameDiagnostics = 0;
  await context.addInitScript(() => {
    const errors: string[] = [];
    Object.assign(window, { socialErrors: errors });
    window.addEventListener("error", (event) => errors.push(event.message));
    window.addEventListener("unhandledrejection", (event) =>
      errors.push(String(event.reason)),
    );
  });
  const guard = (target: Page) =>
    target.on("pageerror", (error) => {
      if (
        engine === "webkit" &&
        [ordinaryHost, helmetHost].some((host) => {
          if (!target.url().startsWith(`${host}/`)) return false;
          const diagnostic = `Blocked a frame with origin "${host}" from accessing a frame with origin "${base}".  The frame requesting access has a protocol of "http", the frame being accessed has a protocol of "https". Protocols must match.`;
          // Playwright splits WebKit console errors at the first colon. In
          // this diagnostic that colon belongs to the host's URL scheme.
          const colon = diagnostic.indexOf(":");
          return (
            error.stack?.startsWith(`${diagnostic}\n`) ||
            (error.name === diagnostic.slice(0, colon) &&
              error.message.trimEnd() === diagnostic.slice(colon + 2))
          );
        })
      )
        webkitFrameDiagnostics++;
      else browserErrors.push(error.message);
    });
  context.on("page", guard);
  guard(page);
  const raw = await apiRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    await page.goto(base);
    await signIn(page, "admin@fixture.invalid");
    const adminCookie = (await context.cookies(base)).find((cookie) =>
      cookie.name.endsWith("better-auth.session_token"),
    )!;
    assert(adminCookie?.httpOnly && adminCookie.secure);
    const cases = [];
    for (const [index, host, coop] of [
      [0, ordinaryHost, false],
      [1, ordinaryHost, true],
      [2, helmetHost, true],
    ] as const) {
      mock.controls.coop = coop;
      const drawer = await context.newPage();
      const cookies: boolean[] = [],
        failures: string[] = [];
      const observed: Promise<void>[] = [];
      drawer.on("request", (request) => {
        if (
          request.url().startsWith(base + "/api/") &&
          request.frame().page() === drawer
        )
          observed.push(
            request
              .allHeaders()
              .then((headers) => {
                cookies.push(!!headers.cookie);
              })
              .catch((error: unknown) => {
                failures.push(String(error));
              }),
          );
      });
      try {
        const frame = await frameOn(drawer, host, base);
        const email = `social-${engine}-${index}@fixture.invalid`;
        await social(drawer, frame, email, { noOpener: coop });
        const user = (
          await pool.query('select id,role,image from "user" where email=$1', [
            email,
          ])
        ).rows[0];
        assert.equal(user.role, "user", "IdP role input gained authority");
        assert.equal(user.image, mock.controls.picture);
        assert.deepEqual(
          (
            await pool.query(
              'select distinct scope from auth_session where "userId"=$1',
              [user.id],
            )
          ).rows,
          [{ scope: "embedded" }],
        );
        const account = (
          await pool.query(
            'select "accessToken","refreshToken","idToken" from auth_account where "userId"=$1',
            [user.id],
          )
        ).rows[0];
        assert(
          Object.values(account).every((value) => value === null),
          "Provider tokens persisted after sign-up",
        );
        const token = await frame.evaluate(() =>
          localStorage.getItem("feedbackland-embedded-session"),
        );
        assert(token);
        // Even an admin identity's handoff token remains embedded.
        await pool.query("update \"user\" set role='admin' where id=$1", [
          user.id,
        ]);
        for (const credential of <Record<string, string>[]>[
          { authorization: "Bearer " + token },
          {
            cookie:
              "__Secure-better-auth.session_token=" + encodeURIComponent(token),
          },
        ]) {
          const response = await raw.post(base + "/api/trpc/updateSettings", {
            headers: {
              "content-type": "application/json",
              origin: base,
              "sec-fetch-site": "same-origin",
              ...credential,
            },
            data: {
              json: { platformTitle: "Forbidden", expectedRevision: "1" },
            },
          });
          assert.equal(response.status(), 403);
          const chat = await raw.post(base + "/api/chat", {
            headers: {
              "content-type": "application/json",
              origin: base,
              "sec-fetch-site": "same-origin",
              ...credential,
            },
            data: { messages: [] },
          });
          assert.equal(
            chat.status(),
            403,
            "Embedded social token gained chat authority",
          );
        }
        await pool.query("update \"user\" set role='user' where id=$1", [
          user.id,
        ]);
        const current = await frame.evaluate(async () => {
          const r = await fetch("/api/auth/get-session", {
            credentials: "omit",
            headers: {
              authorization:
                "Bearer " +
                localStorage.getItem("feedbackland-embedded-session"),
              "x-feedbackland-scope": "embedded",
            },
          });
          return r.json();
        });
        assert.equal(current.session.scope, "embedded");
        const before = frame.url();
        const signOutReply = drawer.waitForResponse((response) =>
          response.url().endsWith("/api/auth/sign-out"),
        );
        void signOutReply.catch(() => {});
        await frame
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        assert.equal((await (await signOutReply).json()).url, undefined);
        await frame
          .getByRole("button", {
            name: "Sign in to manage feedback",
            exact: true,
          })
          .waitFor();
        assert.equal(frame.url(), before);
        assert(
          (await context.cookies(base)).find(
            (cookie) => cookie.name === adminCookie.name,
          )?.value === adminCookie.value,
          "Embedded callback replaced the earlier first-party cookie",
        );
        // Returning provider callbacks must also keep account tokens absent.
        await social(drawer, frame, email, { noOpener: coop });
        assert(
          Object.values(
            (
              await pool.query(
                'select "accessToken","refreshToken","idToken" from auth_account where "userId"=$1',
                [user.id],
              )
            ).rows[0],
          ).every((value) => value === null),
          "Provider tokens persisted after returning sign-in",
        );
        await frame
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await frame
          .getByRole("button", {
            name: "Sign in to manage feedback",
            exact: true,
          })
          .waitFor();
        drawer.removeAllListeners("request");
        await Promise.all(observed);
        assert.deepEqual(failures, []);
        assert(
          cookies.length > 0 && cookies.every((value) => !value),
          "Embedded auth/handoff sent ambient cookies",
        );
        cases.push({
          coop,
          helmet: index === 2,
          cookieFreeRequests: cookies.length,
          embeddedScope: true,
          returningTokensRemoved: true,
        });
        for (const frame of drawer.frames())
          assert.deepEqual(
            await frame.evaluate(
              () =>
                (window as unknown as { socialErrors: string[] }).socialErrors,
            ),
            [],
          );
        assert.deepEqual(browserErrors, []);
      } catch (error) {
        await diagnose(drawer, resolve(artifacts, `social-${engine}-${index}`));
        throw error;
      } finally {
        drawer.removeAllListeners("request");
        await drawer.close();
        await Promise.all(observed);
      }
    }
    mock.controls.coop = true;
    const fresh = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const drawer = await fresh.newPage();
      const frame = await frameOn(drawer, helmetHost, base);
      const email = `fresh-${engine}@fixture.invalid`;
      await social(drawer, frame, email, { noOpener: true });
      assert.equal(
        (await fresh.cookies(base)).filter((cookie) =>
          cookie.name.endsWith("better-auth.session_token"),
        ).length,
        0,
        "Embedded callback left a first-party cookie",
      );
      assert.deepEqual(
        (
          await pool.query(
            'select s.scope from auth_session s join "user" u on u.id=s."userId" where u.email=$1',
            [email],
          )
        ).rows,
        [{ scope: "embedded" }],
      );
    } finally {
      await fresh.close();
    }
    const expired = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const drawer = await expired.newPage();
      const frame = await frameOn(drawer, helmetHost, base);
      const email = `expired-${engine}@fixture.invalid`;
      await social(drawer, frame, email, {
        noOpener: true,
        expired: true,
        beforeApprove: async (ticket) => {
          await pool.query(
            "update auth_verification set \"expiresAt\"=clock_timestamp()-interval '1 second' where id=$1",
            ["popup-handoff:" + ticket],
          );
        },
      });
      assert.equal(
        (await expired.cookies(base)).filter((cookie) =>
          cookie.name.endsWith("better-auth.session_token"),
        ).length,
        0,
      );
      assert.equal(
        (
          await pool.query(
            'select s.id from auth_session s join "user" u on u.id=s."userId" where u.email=$1',
            [email],
          )
        ).rows.length,
        0,
        "Expired embedded callback retained a usable session",
      );
    } finally {
      await expired.close();
    }
    // Error callbacks are delivered through polling even with no opener.
    for (const [email, options] of [
      ["admin@fixture.invalid", { error: "This email is already registered" }],
      [
        `denied-${engine}@fixture.invalid`,
        { error: "Sign-in was declined", deny: true },
      ],
      [
        `badstate-${engine}@fixture.invalid`,
        { error: "could not be verified", badState: true },
      ],
    ] as const) {
      const drawer = await context.newPage();
      try {
        const frame = await frameOn(drawer, helmetHost, base);
        await social(drawer, frame, email, { ...options, noOpener: true });
      } catch (error) {
        await diagnose(drawer, resolve(artifacts, `social-errors-${engine}`));
        throw error;
      } finally {
        await drawer.close();
      }
    }
    // The done page cannot bind a visitor's ambient first-party session.
    const foreignTicket = randomBytes(16).toString("hex");
    const done = await context.newPage();
    await done.goto(base + "/auth/popup/done?ticket=" + foreignTicket);
    assert.equal(
      (
        await pool.query("select id from auth_verification where id=$1", [
          "popup-handoff:" + foreignTicket,
        ])
      ).rows.length,
      0,
    );
    await done.close().catch(() => {});
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
    await social(page, page, `firstparty-${engine}@fixture.invalid`, {
      noOpener: true,
    });
    const session = await page.evaluate(async () =>
      (await fetch("/api/auth/get-session", { credentials: "include" })).json(),
    );
    assert.equal(session.session.scope, "first-party");
    assert.equal(mock.controls.logoutRequests, 0);
    assert.deepEqual(browserErrors, []);
    return {
      engine,
      cases,
      errors: ["account_not_linked", "access_denied", "state_mismatch"],
      firstPartyPopup: true,
      foreignDoneBindsNothing: true,
      noPriorCookieCleanup: true,
      expiredCallbackCleanup: true,
      uncaughtErrors: browserErrors.length,
      webkitFrameDiagnostics,
    };
  } catch (error) {
    await diagnose(page, resolve(artifacts, `social-${engine}`));
    throw error;
  } finally {
    await raw.dispose();
    await context.close();
  }
}

export async function phaseFour(
  image: string,
  runId: string,
  artifacts: string,
  check: Check,
) {
  assert.equal(
    process.platform,
    "linux",
    "The HTTPS three-engine gates require Linux (Docker Desktop host networking is not assumed)",
  );
  assert.match(runId, /^p05-[0-9]+-[a-f0-9]+$/);
  const project = runId + "-social";
  const directory = await mkdtemp(join(tmpdir(), project + "-"));
  const containers: string[] = [];
  const certificateVolume = project + "-certificates";
  let certificateVolumeCreated = false;
  const servers: Array<Awaited<ReturnType<typeof createAuthWidgetHost>>> = [];
  let pool: Pool | undefined;
  let browser: Browser | undefined;
  let primary: unknown;
  const docker = (...args: string[]) =>
    command("docker", args, { timeout: 180_000 });
  try {
    const database = project + "-db";
    containers.push(database);
    await docker(
      "run",
      "-d",
      "--name",
      database,
      "--tmpfs",
      "/var/lib/postgresql:size=512m",
      "-e",
      "POSTGRES_PASSWORD=fixture-only",
      "-p",
      "127.0.0.1::5432",
      pgImage,
    );
    await eventually(
      () => docker("exec", database, "pg_isready", "-U", "postgres"),
      (value) => value.includes("accepting connections"),
    );
    const dbInfo = JSON.parse(await docker("inspect", database))[0];
    const dbUrl = `postgres://postgres:fixture-only@127.0.0.1:${dbInfo.NetworkSettings.Ports["5432/tcp"][0].HostPort}/postgres`;
    pool = new Pool({ connectionString: dbUrl });
    await pool.query("create database contracts");
    await check("social/recovery-reset-handoff-contracts", async () => {
      const output = await command(
        process.execPath,
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/e2e/p05-contracts.ts",
        ],
        {
          env: {
            DATABASE_URL: dbUrl.replace(/\/postgres$/, "/contracts"),
            DATABASE_POOL_MAX: "2",
            APP_URL: "https://fixture.invalid",
            RECOVERY_CODE: randomBytes(32).toString("hex"),
          },
          timeout: 240_000,
        },
      );
      return JSON.parse(output.split(/\r?\n/).at(-1)!);
    });
    const [a, b, c, gateway, smtp, mailApi] = await Promise.all([
      port(),
      port(),
      port(),
      port(),
      port(),
      port(),
    ]);
    const board = `https://localhost:${gateway}`;
    await command("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(directory, "board.key"),
      "-out",
      join(directory, "board.crt"),
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ]);
    await writeFile(
      join(directory, "Caddyfile"),
      `{\n admin off\n auto_https off\n}\nhttps://localhost:${gateway} {\n tls /certs/board.crt /certs/board.key\n @b header X-Fixture-Replica B\n handle @b {\n header X-Fixture-Replica B\n reverse_proxy 127.0.0.1:${b}\n }\n handle {\n header X-Fixture-Replica A\n reverse_proxy 127.0.0.1:${a}\n }\n}\n`,
    );
    const proxy = project + "-tls";
    await docker("volume", "create", certificateVolume);
    certificateVolumeCreated = true;
    const copy = project + "-tls-copy";
    containers.push(copy);
    await docker(
      "create",
      "--name",
      copy,
      "--mount",
      `type=volume,source=${certificateVolume},target=/certs`,
      caddyImage,
    );
    await docker("cp", directory + "/.", copy + ":/certs");
    const mock = await createOidcMock({
      key: await readFile(join(directory, "board.key")),
      cert: await readFile(join(directory, "board.crt")),
    });
    servers.push(mock.server);
    mock.controls.picture = board + "/icon.svg";
    const mail = project + "-mail";
    containers.push(mail);
    await docker(
      "run",
      "-d",
      "--name",
      mail,
      "--network",
      "host",
      "--read-only",
      "--tmpfs",
      "/tmp:size=32m",
      mailpitImage,
      "--smtp",
      `127.0.0.1:${smtp}`,
      "--listen",
      `127.0.0.1:${mailApi}`,
      "--disable-version-check",
      "--smtp-disable-rdns",
      "--quiet",
    );
    await eventually(
      () =>
        fetch(`http://127.0.0.1:${mailApi}/api/v1/messages`).then(
          (response) => response.status,
        ),
      (status) => status === 200,
    );
    const setupCode = randomBytes(32).toString("hex"),
      recoveryCode = randomBytes(32).toString("hex");
    const startReplica = async (
      suffix: string,
      listen: number,
      configured = true,
      recovery = true,
    ) => {
      const name = project + "-" + suffix;
      if (!containers.includes(name)) containers.push(name);
      await docker(
        "run",
        "-d",
        "--name",
        name,
        "--network",
        "host",
        "--read-only",
        "--tmpfs",
        "/tmp:size=64m",
        "--tmpfs",
        "/app/.next/cache:size=64m",
        "--mount",
        `type=volume,source=${certificateVolume},target=/fixture-ca,readonly`,
        "-e",
        "NODE_EXTRA_CA_CERTS=/fixture-ca/board.crt",
        "-e",
        "HOSTNAME=0.0.0.0",
        "-e",
        `PORT=${listen}`,
        "-e",
        `DATABASE_URL=${dbUrl}`,
        "-e",
        "DATABASE_POOL_MAX=2",
        ...(configured ? ["-e", `APP_URL=${board}`] : []),
        "-e",
        `SETUP_CODE=${setupCode}`,
        ...(recovery ? ["-e", `RECOVERY_CODE=${recoveryCode}`] : []),
        "-e",
        `OIDC_ISSUER=${mock.issuer}`,
        "-e",
        "OIDC_CLIENT_ID=fixture-client",
        "-e",
        "OIDC_CLIENT_SECRET=fixture-secret",
        "-e",
        "OIDC_NAME=Fixture SSO",
        "-e",
        `SMTP_URL=smtp://localhost:${smtp}`,
        "-e",
        "SMTP_FROM=Fixture <fixture@fixture.invalid>",
        image,
      );
      await eventually(
        () =>
          fetch(`http://127.0.0.1:${listen}/api/health`).then(
            (response) => response.status,
          ),
        (status) => status === 200,
      );
    };
    await startReplica("a", a);
    await startReplica("b", b);
    containers.push(proxy);
    await docker(
      "run",
      "-d",
      "--name",
      proxy,
      "--network",
      "host",
      "--read-only",
      "--tmpfs",
      "/data:size=32m",
      "--tmpfs",
      "/config:size=8m",
      "--mount",
      `type=volume,source=${certificateVolume},target=/certs,readonly`,
      caddyImage,
      "caddy",
      "run",
      "--config",
      "/certs/Caddyfile",
      "--adapter",
      "caddyfile",
    );
    browser = await chromium.launch({
      env: toolEnvironment() as Record<string, string>,
    });
    const adminContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const adminPage = await adminContext.newPage();
    await eventually(
      () =>
        adminContext.request
          .get(board + "/api/health")
          .then((response) => response.status()),
      (status) => status === 200,
    );
    await submitSetup(adminPage, board, setupCode);
    await check("social/two-replica-discovery", async () => {
      const initial = await adminContext.request.get(board + "/api/settings", {
        headers: { "x-fixture-replica": "B" },
      });
      assert.equal(initial.headers()["x-fixture-replica"], "B");
      assert.deepEqual((await initial.json()).capabilities.socialProviders, []);
      assert(
        (await docker("logs", project + "-b")).includes(
          "auth.discovery-failed",
        ),
      );
      mock.controls.ready = true;
      const started = Date.now();
      await rpc(adminContext, board, "retryOidcDiscovery", null);
      await eventually(
        async () => {
          const response = await adminContext.request.get(
            board + "/api/settings",
            { headers: { "x-fixture-replica": "B" } },
          );
          assert.equal(response.headers()["x-fixture-replica"], "B");
          return (await response.json()).capabilities.socialProviders;
        },
        (providers) => providers.includes("oidc"),
        15_000,
      );
      const elapsedMs = Date.now() - started;
      assert(elapsedMs <= 15_000);
      return {
        initialFailureOnBoth: true,
        retryThrough: "A",
        providerThrough: "B",
        elapsedMs,
      };
    });
    await check("social/discovery-cancellation-and-retention", async () => {
      const initial = mock.controls.discoveries;
      mock.controls.stall = true;
      await pool!.query(
        'update auth_runtime set "discoveryEpoch"="discoveryEpoch"+1 where id=1',
      );
      await eventually(
        async () => mock.controls.discoveries,
        (count) => count >= initial + 2,
        10_000,
      );
      mock.controls.stall = false;
      const started = Date.now();
      await pool!.query(
        'update auth_runtime set "discoveryEpoch"="discoveryEpoch"+1 where id=1',
      );
      await eventually(
        async () => mock.controls.abortedDiscoveries,
        (count) => count >= 2,
        10_000,
      );
      for (const replica of ["A", "B"]) {
        await eventually(
          async () => {
            const response = await adminContext.request.get(
              board + "/api/settings",
              { headers: { "x-fixture-replica": replica } },
            );
            return (await response.json()).capabilities.socialProviders;
          },
          (providers) => providers.includes("oidc"),
          15_000,
        );
      }
      const elapsedMs = Date.now() - started;
      mock.controls.ready = false;
      const before = mock.controls.discoveries;
      await pool!.query(
        'update auth_runtime set "discoveryEpoch"="discoveryEpoch"+1 where id=1',
      );
      await eventually(
        async () => mock.controls.discoveries,
        (count) => count >= before + 2,
        10_000,
      );
      for (const replica of ["A", "B"]) {
        const response = await adminContext.request.get(
          board + "/api/settings",
          { headers: { "x-fixture-replica": replica } },
        );
        assert(
          (await response.json()).capabilities.socialProviders.includes("oidc"),
        );
      }
      const password = await browser!.newContext({ ignoreHTTPSErrors: true });
      try {
        const response = await password.request.post(
          board + "/api/auth/sign-in/email",
          {
            headers: { origin: board },
            data: { email: "admin@fixture.invalid", password: fixturePassword },
          },
        );
        assert.equal(response.status(), 200);
      } finally {
        await password.close();
      }
      const attempts = mock.controls.discoveries;
      mock.controls.ready = true;
      // No epoch bump or process restart: the same failed epoch retries at
      // its one-minute deadline on both replicas.
      await eventually(
        async () => mock.controls.discoveries,
        (count) => count >= attempts + 2,
        65_000,
      );
      for (const replica of ["A", "B"]) {
        const response = await adminContext.request.get(
          board + "/api/trpc/getAuthStatus",
          { headers: { "x-fixture-replica": replica } },
        );
        assert.equal(response.status(), 200);
        const provider = (
          await response.json()
        ).result.data.json.providers.find(
          (item: { id: string }) => item.id === "oidc",
        );
        assert.equal(provider.enabled, true);
        assert.equal(provider.reason, null);
      }
      return {
        abortedObsoleteRequests: mock.controls.abortedDiscoveries,
        elapsedMs,
        lastWorkingProviderRetained: true,
        passwordSignInDuringDiscoveryFailure: true,
        automaticRetryWithoutEpochChange: true,
      };
    });
    await check("social/mail-reset-links", () =>
      mailContracts(
        browser!,
        adminContext,
        board,
        `http://127.0.0.1:${a}`,
        `http://127.0.0.1:${mailApi}`,
        pool!,
      ),
    );
    const host = await createAuthWidgetHost(),
      helmet = await createHelmetHost(board);
    for (const server of [host, helmet]) {
      servers.push(server);
      await new Promise<void>((yes, no) => {
        server.once("error", no);
        server.listen(0, "0.0.0.0", yes);
      });
    }
    const hostAddress = host.address(),
      helmetAddress = helmet.address();
    assert(
      hostAddress &&
        typeof hostAddress !== "string" &&
        helmetAddress &&
        typeof helmetAddress !== "string",
    );
    const normalHost = `http://127.0.0.1:${hostAddress.port}`,
      helmetHost = `http://127.0.0.1:${helmetAddress.port}`;
    assert.equal(
      (
        await fetch(helmetHost + "/?board=" + encodeURIComponent(board))
      ).headers.get("cross-origin-opener-policy"),
      "same-origin",
    );
    await adminContext.close();
    await browser.close();
    browser = undefined;
    for (const [engine, launcher] of Object.entries({
      chromium,
      firefox,
      webkit,
    })) {
      await check("social/browser-" + engine, async () => {
        browser = await launcher.launch({
          env: toolEnvironment() as Record<string, string>,
        });
        try {
          return await socialBrowser(
            browser,
            board,
            normalHost,
            helmetHost,
            mock,
            pool!,
            artifacts,
          );
        } finally {
          await browser.close();
          browser = undefined;
        }
      });
    }
    assert(mock.controls.jwksRequests > 0 && mock.controls.tokenExchanges > 0);
    await check("social/inferred-origin-and-operator-recovery", async () => {
      await startReplica("c", c, false);
      browser = await chromium.launch({
        env: toolEnvironment() as Record<string, string>,
      });
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const base = `http://localhost:${c}`;
      try {
        const capabilities = (
          await (await context.request.get(base + "/api/settings")).json()
        ).capabilities;
        assert.equal(capabilities.smtp, false);
        assert.deepEqual(capabilities.socialProviders, []);
        const page = await context.newPage();
        await page.goto(base);
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Sign in with Email", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Forgot password?", exact: true })
          .click();
        await page
          .getByRole("status")
          .filter({ hasText: "Ask an administrator" })
          .waitFor();
        const login = await context.request.post(
          base + "/api/auth/sign-in/email",
          {
            headers: { origin: base },
            data: { email: "admin@fixture.invalid", password: fixturePassword },
          },
        );
        assert.equal(login.status(), 200);
        const member = await browser.newContext();
        const email = "inferred-reset@fixture.invalid";
        let userId: string;
        try {
          userId = await passwordAccount(member, base, email);
        } finally {
          await member.close();
        }
        const link = await rpc(context, base, "createPasswordResetLink", {
          email,
        });
        assert.equal(new URL(link.url).origin, base);
        await resetForm(page, link.url, "Inferred-reset-password-42");
        assert.equal(
          (
            await pool!.query('select id from auth_session where "userId"=$1', [
              userId,
            ])
          ).rows.length,
          0,
        );
        // Existing administrators block recovery of ordinary users; social-only
        // identities cannot gain a password through operator recovery.
        await recoverForm(
          page,
          base,
          recoveryCode,
          email,
          "Must-not-reset-password-42",
          true,
        );
        await recoverForm(
          page,
          base,
          recoveryCode,
          "firstparty-chromium@fixture.invalid",
          "Must-not-create-password-42",
          true,
        );
        await recoverForm(
          page,
          base,
          recoveryCode,
          "admin@fixture.invalid",
          "Recovered-admin-password-42",
        );
        const adminId = (
          await pool!.query('select id from "user" where email=$1', [
            "admin@fixture.invalid",
          ])
        ).rows[0].id;
        assert.equal(
          (
            await pool!.query('select id from auth_session where "userId"=$1', [
              adminId,
            ])
          ).rows.length,
          0,
        );
        await pool!.query("update \"user\" set role='user'");
        await recoverForm(
          page,
          base,
          recoveryCode,
          email,
          "Repaired-owner-password-42",
        );
        assert.equal(
          (await pool!.query('select role from "user" where id=$1', [userId]))
            .rows[0].role,
          "admin",
        );
        const passwordLogin = await context.request.post(
          base + "/api/auth/sign-in/email",
          {
            headers: { origin: base },
            data: { email, password: "Repaired-owner-password-42" },
          },
        );
        assert.equal(passwordLogin.status(), 200);
        assert.equal(
          (
            await (
              await fetch(`http://127.0.0.1:${mailApi}/api/v1/messages`)
            ).json()
          ).total,
          1,
        );
        // Remove the operator code in every process; a streamed shell must not
        // turn the disabled route into a misleading HTTP 200.
        for (const [suffix, listen, configured] of [
          ["a", a, true],
          ["b", b, true],
          ["c", c, false],
        ] as const) {
          await docker("rm", "-f", project + "-" + suffix);
          await startReplica(suffix, listen, configured, false);
          const direct = `http://localhost:${listen}`;
          assert.equal(
            (await context.request.get(direct + "/recover")).status(),
            404,
          );
        }
        return {
          smtpDisabledWithoutOrigin: true,
          adminLinkWithoutConfiguredOrigin: true,
          codeAndEmailConfirmation: true,
          adminResetRevokesSessions: true,
          zeroAdminRepair: true,
          socialOnlyRefused: true,
          codeRemovedOnAllReplicas: true,
        };
      } finally {
        await context.close();
        await browser.close();
        browser = undefined;
      }
    });
  } catch (error) {
    primary = sanitizedFailure(error);
    throw primary;
  } finally {
    await check("social/cleanup", async () => {
      const failures: unknown[] = [];
      for (const action of [
        () => browser?.close(),
        ...servers.map(
          (server) => () =>
            new Promise<void>((yes, no) => {
              server.closeAllConnections();
              server.close((error) => (error ? no(error) : yes()));
            }),
        ),
        () => pool?.end(),
        ...containers.reverse().map((name) => async () => {
          assert(name.startsWith(project + "-"));
          await docker("rm", "-f", "--volumes", name);
        }),
        ...(certificateVolumeCreated
          ? [() => docker("volume", "rm", certificateVolume)]
          : []),
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
          "Social checks/cleanup failed",
        );
      return {
        ownedContainers: containers.length,
        temporaryKeysRemoved: true,
        fixtureServersClosed: true,
      };
    });
  }
}
