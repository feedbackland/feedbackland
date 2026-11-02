import assert from "node:assert/strict";
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type Frame,
  type Page,
} from "playwright";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { command, eventually, toolEnvironment } from "./run";
import { submitSetup, fixturePassword } from "./setup-browser";

type Check = (name: string, action: () => Promise<unknown>) => Promise<void>;
type Calls = { url: string; credentials: string; authorization: boolean }[];
async function observe(browser: Browser, blockedStorage = false) {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ blockedStorage }) => {
      const target = window as unknown as { authCalls: Calls };
      target.authCalls = [];
      if (blockedStorage)
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Fixture storage denied", "SecurityError");
          },
        });
      const original = window.fetch;
      window.fetch = (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (/\/api\/(auth|trpc)\//.test(url))
          target.authCalls.push({
            url: new URL(url, location.href).pathname,
            credentials: init?.credentials ?? "same-origin",
            authorization: new Headers(init?.headers).has("authorization"),
          });
        return original(input, init);
      };
    },
    { blockedStorage },
  );
  return context;
}
async function settleNotifications(page: Page) {
  await page.bringToFront();
  await page.mouse.move(0, 0);
  await eventually(
    () => page.locator("[data-sonner-toast]").count(),
    (count) => count === 0,
    15_000,
  );
}
async function signIn(target: Page | Frame, email: string, signup = false) {
  await target
    .getByRole("button", { name: /Sign in to manage feedback|^Sign in$/ })
    .first()
    .click();
  if (signup)
    await target.getByRole("button", { name: "Sign up", exact: true }).click();
  await target
    .getByRole("button", {
      name: signup ? "Sign up with Email" : "Sign in with Email",
      exact: true,
    })
    .click();
  if (signup)
    await target
      .getByLabel("Username", { exact: true })
      .fill("Fixture visitor");
  await target.getByLabel("Email", { exact: true }).fill(email);
  await target.getByLabel("Password", { exact: true }).fill(fixturePassword);
  await target
    .getByRole("button", { name: signup ? "Sign up" : "Sign in", exact: true })
    .click();
  await target.getByRole("dialog").waitFor({ state: "hidden" });
}
async function ownContent(page: Page, base: string) {
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", {
        name: "Visitor own feedback",
        exact: true,
      }),
    })
    .click();
  await page
    .getByRole("heading", {
      name: "Visitor own feedback",
      level: 1,
      exact: true,
    })
    .waitFor();
  const vote = page.getByRole("button", {
    name: "Upvote feedback",
    exact: true,
  });
  await vote.click();
  await eventually(
    () => vote.innerText(),
    (text) => text.trim() === "1",
  );
  await page.locator('[contenteditable="true"]').fill("Visitor comment");
  await page
    .getByRole("button", { name: "Submit comment", exact: true })
    .click();
  await page.getByText("Visitor comment", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Open options menu", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("menuitem", { name: "Edit comment", exact: true })
    .click();
  await page
    .locator('[contenteditable="true"]')
    .last()
    .fill("Visitor comment edited");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Visitor comment edited", { exact: true }).waitFor();
  const commentVote = page.getByRole("button", {
    name: "Upvote comment",
    exact: true,
  });
  await commentVote.click();
  await eventually(
    () => commentVote.innerText(),
    (text) => text.trim() === "1",
  );
  await page
    .getByRole("button", { name: "Open options menu", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("menuitem", { name: "Delete comment", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page
    .getByText("Visitor comment edited", { exact: true })
    .waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Open options menu", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Edit post", exact: true }).click();
  await page
    .getByPlaceholder("Title", { exact: true })
    .fill("Visitor feedback edited");
  await page
    .locator("form")
    .filter({ has: page.getByPlaceholder("Title", { exact: true }) })
    .locator('[contenteditable="true"]')
    .fill("Visitor description edited");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Visitor feedback edited",
      level: 1,
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Open options menu", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Delete post", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.waitForURL(base + "/");
}
async function frameOn(page: Page, host: string, base: string) {
  await page.bringToFront();
  await page.goto(host + "/?board=" + encodeURIComponent(base));
  await eventually(
    () =>
      Promise.resolve(
        page.frames().find((frame) => frame.url().startsWith(base)),
      ),
    Boolean,
  );
  const frame = page.frames().find((frame) => frame.url().startsWith(base))!;
  await frame
    .getByRole("textbox", { name: "Your feedback", exact: true })
    .waitFor();
  return frame;
}
async function browserContracts(
  browser: Browser,
  base: string,
  code: string,
  hostPort: number,
  artifact: string,
) {
  const context = await observe(browser);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await submitSetup(page, base, code);
    await page.getByRole("tab", { name: "Settings", exact: true }).click();
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Platform title", { exact: true })
      .fill("Fixture board updated");
    await page
      .locator("form")
      .filter({ has: page.getByLabel("Platform title", { exact: true }) })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await eventually(
      async () =>
        (await (await fetch(base + "/api/settings")).json()).platformTitle,
      (value) => value === "Fixture board updated",
    );
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.waitForURL(base + "/");
    await page
      .getByRole("link", { name: "Admin Panel", exact: true })
      .waitFor();
    const firstPartyCalls = await page.evaluate(
      () => (window as unknown as { authCalls: Calls }).authCalls,
    );
    assert(
      firstPartyCalls.some((call) => call.url.includes("/auth/get-session")),
    );
    assert(
      firstPartyCalls.every(
        (call) => call.credentials === "include" && !call.authorization,
      ),
    );
    const cookieBefore = (await context.cookies(base)).find((cookie) =>
      cookie.name.endsWith("better-auth.session_token"),
    )!;
    const anonymous = await fetch(base + "/api/feedback/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "Anonymous protected target" }),
    });
    assert.equal(anonymous.status, 201);
    const targetId: string = (await anonymous.json()).id;
    const rows = [];
    for (const host of ["localhost", "127.0.0.1"]) {
      const drawerPage = await context.newPage();
      const network: unknown[] = [];
      const observed: Promise<void>[] = [];
      drawerPage.on("request", (request) => {
        if (request.url().includes("/api/auth/"))
          observed.push(
            (async () => {
              const h = await request.allHeaders();
              network.push({
                path: new URL(request.url()).pathname,
                cookie: !!h.cookie,
                bearer: !!h.authorization,
                scope: h["x-feedbackland-scope"],
              });
            })(),
          );
      });
      drawerPage.on("response", (response) => {
        if (response.url().includes("/api/auth/get-session"))
          observed.push(
            (async () => {
              try {
                const data = await response.json();
                network.push({
                  status: response.status(),
                  sessionScope: data?.session?.scope,
                  userRole: data?.user?.role,
                });
              } catch {
                network.push({ status: response.status() });
              }
            })(),
          );
      });
      const frame = await frameOn(
        drawerPage,
        `http://${host}:${hostPort}`,
        base,
      );
      assert.equal(
        await frame
          .getByRole("link", { name: "Admin Panel", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await frame.getByText("Fixture admin", { exact: true }).count(),
        0,
      );
      const loginReply = drawerPage.waitForResponse((response) =>
        response.url().endsWith("/api/auth/sign-in/email"),
      );
      void loginReply.catch(() => {});
      try {
        await signIn(frame, "admin@fixture.invalid");
      } catch (error) {
        await drawerPage.screenshot({ path: artifact + "-drawer.png" });
        await Promise.allSettled(observed);
        await writeFile(
          artifact + "-drawer.txt",
          JSON.stringify(
            {
              host,
              body: await frame.locator("body").innerText(),
              network,
              storage: await frame.evaluate(() => {
                try {
                  return {
                    hasToken: !!localStorage.getItem(
                      "feedbackland-embedded-session",
                    ),
                    calls: (window as unknown as { authCalls: Calls })
                      .authCalls,
                  };
                } catch {
                  return { denied: true };
                }
              }),
            },
            null,
            2,
          ),
        );
        throw error;
      }
      const bearer = (await (await loginReply).allHeaders())["set-auth-token"];
      assert(bearer);
      await frame
        .getByText("Signed in as Fixture admin", { exact: true })
        .waitFor();
      assert.equal(
        await frame
          .getByRole("link", { name: "Admin Panel", exact: true })
          .count(),
        0,
      );
      const session = await frame.evaluate(async (token) => {
        const response = await fetch("/api/auth/get-session", {
          credentials: "omit",
          headers: { authorization: "Bearer " + token },
        });
        const data = await response.json();
        return { scope: data.session.scope, role: data.user.role };
      }, bearer);
      assert.deepEqual(session, { scope: "embedded", role: "admin" });
      const calls = await frame.evaluate(
        () => (window as unknown as { authCalls: Calls }).authCalls,
      );
      assert(calls.filter((call) => /\/auth\//.test(call.url)).length >= 3);
      assert(calls.every((call) => call.credentials === "omit"));
      for (const credential of <Record<string, string>[]>[
        { authorization: "Bearer " + bearer },
        { cookie: "better-auth.session_token=" + bearer },
      ]) {
        for (const [path, body] of [
          [
            "updateFeedbackPost",
            {
              postId: targetId,
              title: "Forbidden",
              description: "Forbidden",
              expectedRevision: "1",
            },
          ],
          ["deleteFeedbackPost", { postId: targetId }],
          ["updateSettings", {}],
          ["createAdminInvite", {}],
          ["deleteAdmin", {}],
        ] as const) {
          const response = await fetch(base + "/api/trpc/" + path, {
            method: "POST",
            headers: { "content-type": "application/json", ...credential },
            body: JSON.stringify({ json: body }),
          });
          assert.equal(response.status, 403, path);
        }
        assert.equal(
          (
            await fetch(base + "/api/chat", {
              method: "POST",
              headers: { "content-type": "application/json", ...credential },
              body: "{}",
            })
          ).status,
          403,
        );
      }
      await Promise.all(observed);
      assert(
        network.every((entry) => !(entry as { cookie?: boolean }).cookie),
        "Embedded script request sent an ambient cookie: " +
          JSON.stringify(network),
      );
      // A signed-in admin's drawer remains an ordinary-author surface.
      await frame
        .getByRole("textbox", { name: "Your feedback", exact: true })
        .fill("Embedded own feedback " + host);
      await frame
        .getByRole("button", { name: "Submit feedback", exact: true })
        .click();
      await frame.getByText("Feedback submitted", { exact: true }).waitFor();
      await frame
        .getByRole("button", { name: "Sign out", exact: true })
        .click();
      await frame
        .getByRole("button", {
          name: "Sign in to manage feedback",
          exact: true,
        })
        .waitFor();
      assert.equal(
        (await context.cookies(base)).find(
          (cookie) => cookie.name === cookieBefore.name,
        )?.value,
        cookieBefore.value,
      );
      const stillAdmin = await page.evaluate(
        async () =>
          (
            await (
              await fetch("/api/auth/get-session", { credentials: "include" })
            ).json()
          ).user.role,
      );
      assert.equal(stillAdmin, "admin");
      rows.push({
        host,
        initialCookieIsolation: true,
        embeddedAdmin: "ordinary author",
        signOutIndependent: true,
        requests: calls.length,
      });
      await drawerPage.close();
    }
    // Exercise the actual email signup/signout/signin UI on a clean identity.
    const visitorContext = await observe(browser);
    const visitor = await visitorContext.newPage();
    await visitor.clock.install();
    try {
      await visitor.bringToFront();
      await visitor.goto(base);
      await signIn(visitor, "visitor@fixture.invalid", true);
      await visitor
        .getByRole("button", { name: "Account", exact: true })
        .waitFor();
      await visitor
        .getByRole("textbox", { name: "Your feedback", exact: true })
        .fill("Visitor own feedback");
      await visitor
        .getByRole("button", { name: "Submit feedback", exact: true })
        .click();
      await visitor.getByText("Feedback submitted", { exact: true }).waitFor();
      await ownContent(visitor, base);
      await settleNotifications(visitor);
      const identityVote = visitor
        .locator(`[data-post-id="${targetId}"]`)
        .getByRole("button", { name: "Upvote feedback", exact: true });
      await identityVote.click();
      await eventually(
        () => identityVote.locator("svg").getAttribute("fill"),
        (value) => value === "var(--background)",
      );
      await visitor
        .getByRole("button", { name: "Account", exact: true })
        .click();
      await visitor.getByRole("menuitem", { name: /Fixture visitor/ }).click();
      await visitor
        .getByLabel("Your username", { exact: true })
        .fill("Fixture visitor updated");
      await visitor.getByRole("button", { name: "Save", exact: true }).click();
      await visitor.getByRole("dialog").waitFor({ state: "hidden" });
      await visitor
        .getByText("Posting as Fixture visitor updated.", { exact: true })
        .waitFor();
      await visitorContext.route("**/api/auth/sign-out", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Fixture unavailable" }),
        }),
      );
      await visitor
        .getByRole("button", { name: "Account", exact: true })
        .click();
      await visitor
        .getByRole("menuitem", { name: "Sign out", exact: true })
        .click();
      await visitor
        .getByText("Could not sign out. Try again.", { exact: true })
        .waitFor();
      await visitor
        .getByRole("button", { name: "Account", exact: true })
        .waitFor();
      await visitorContext.unroute("**/api/auth/sign-out");
      await settleNotifications(visitor);
      await visitor
        .getByRole("button", { name: "Account", exact: true })
        .click();
      await visitor
        .getByRole("menuitem", { name: "Sign out", exact: true })
        .click();
      await visitor
        .getByRole("button", {
          name: "Sign in to manage feedback",
          exact: true,
        })
        .waitFor();
      await eventually(
        () => identityVote.locator("svg").getAttribute("fill"),
        (value) => value === "none",
      );
      await signIn(visitor, "visitor@fixture.invalid");
      await eventually(
        () => identityVote.locator("svg").getAttribute("fill"),
        (value) => value === "var(--background)",
      );
      await visitor
        .getByRole("button", { name: "Account", exact: true })
        .waitFor();
      assert.equal(
        await visitor
          .getByRole("link", { name: "Admin Panel", exact: true })
          .count(),
        0,
      );
      // A local sign-out must not permanently mask a later sign-in in another tab.
      await visitor
        .getByRole("button", { name: "Account", exact: true })
        .click();
      await visitor
        .getByRole("menuitem", { name: "Sign out", exact: true })
        .click();
      await visitor
        .getByRole("button", {
          name: "Sign in to manage feedback",
          exact: true,
        })
        .waitFor();
      const peer = await visitorContext.newPage();
      await peer.bringToFront();
      await peer.goto(base);
      await signIn(peer, "visitor@fixture.invalid");
      // Better Auth throttles focus refreshes for five seconds. Advance the
      // browser clock across that boundary, then exercise an actual tab focus.
      await visitor.clock.fastForward(5_100);
      await visitor.bringToFront();
      // Headless tabs can all remain visible. Deliver the visibility-change
      // notification as well, then let the real SDK/session request settle.
      await visitor.evaluate(() =>
        document.dispatchEvent(new Event("visibilitychange")),
      );
      await visitor
        .getByRole("button", { name: "Account", exact: true })
        .waitFor();
      await eventually(
        () => identityVote.locator("svg").getAttribute("fill"),
        (value) => value === "var(--background)",
      );
      await peer.close();
    } catch (error) {
      await visitor.screenshot({ path: artifact + "-visitor.png" });
      await writeFile(
        artifact + "-visitor.txt",
        await visitor.locator("body").innerText(),
      );
      throw error;
    } finally {
      await visitorContext.close();
    }
    // Storage-denied embedded sign-in must work for this page's lifetime.
    const blocked = await observe(browser, true);
    try {
      const blockedPage = await blocked.newPage();
      const frame = await frameOn(
        blockedPage,
        `http://127.0.0.1:${hostPort}`,
        base,
      );
      await signIn(frame, "visitor@fixture.invalid");
      await frame
        .getByText("Signed in as Fixture visitor updated", { exact: true })
        .waitFor();
      await frame
        .getByRole("button", { name: "Sign out", exact: true })
        .click();
      await frame
        .getByRole("button", {
          name: "Sign in to manage feedback",
          exact: true,
        })
        .waitFor();
    } finally {
      await blocked.close();
    }
    assert.deepEqual(errors, []);
    await page.screenshot({ path: artifact });
    return {
      setup: "five-field rendered form and HttpOnly Lax session",
      email:
        "signup, signout, signin, own post/comment CRUD, voting, name update and failed signout",
      firstPartyTransport: "include, no bearer",
      drawer: rows,
      deniedStorage: "memory fallback passed",
    };
  } catch (error) {
    await page.screenshot({ path: artifact }).catch(() => {});
    await writeFile(
      artifact + ".txt",
      JSON.stringify(
        {
          url: page.url(),
          body: await page.locator("body").innerText(),
          errors,
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await context.close();
  }
}
export async function phaseThree(
  image: string,
  runId: string,
  artifacts: string,
  check: Check,
) {
  assert.match(runId, /^p04-[0-9]+-[a-f0-9]+$/);
  const docker = (...args: string[]) =>
    command("docker", args, { timeout: 150_000 });
  const project = runId + "-auth";
  const containers: string[] = [];
  let network = false;
  const server = createServer((req, res) => {
    const board = new URL(req.url!, "http://fixture.invalid").searchParams.get(
      "board",
    );
    if (!board || !/^http:\/\/localhost:[0-9]+$/.test(board)) {
      res.writeHead(400).end();
      return;
    }
    res.setHeader("content-type", "text/html");
    res.end(
      `<html><body><iframe title="Fixture drawer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" src="${board}/?embed=drawer" style="width:850px;height:850px"></iframe></body></html>`,
    );
  });
  let pool: Pool | undefined;
  let primary: unknown;
  try {
    await docker("network", "create", project);
    network = true;
    const database = project + "-db";
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
      "-p",
      "127.0.0.1::5432",
      "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11",
    );
    await eventually(
      () => docker("exec", database, "pg_isready", "-U", "postgres"),
      (value) => value.includes("accepting connections"),
    );
    const state = JSON.parse(await docker("inspect", database))[0];
    assert.equal(state.HostConfig.Tmpfs["/var/lib/postgresql"], "size=512m");
    const url = `postgres://postgres:fixture-only@127.0.0.1:${state.NetworkSettings.Ports["5432/tcp"][0].HostPort}/postgres`;
    pool = new Pool({ connectionString: url });
    await check("auth/setup-credentials-authorization-matrix", async () => {
      const output = await command(
        process.execPath,
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/e2e/auth-contracts.ts",
        ],
        {
          env: {
            DATABASE_URL: url,
            DATABASE_POOL_MAX: "2",
            TRUSTED_PROXIES: "10.0.0.0/8",
          },
          timeout: 180_000,
        },
      );
      return JSON.parse(output.split(/\r?\n/).at(-1)!);
    });
    await new Promise<void>((yes, no) => {
      server.once("error", no);
      server.listen(0, "0.0.0.0", yes);
    });
    const address = server.address();
    assert(address && typeof address !== "string");
    for (const [engine, launcher] of Object.entries({
      chromium,
      firefox,
      webkit,
    })) {
      await check("auth/browser-" + engine, async () => {
        assert(/^(chromium|firefox|webkit)$/.test(engine));
        await pool!.query(`create database ${engine}`);
        let code = randomBytes(32).toString("hex");
        const name = project + "-" + engine;
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
          "-e",
          `DATABASE_URL=postgres://postgres:fixture-only@db:5432/${engine}`,
          "-e",
          "DATABASE_POOL_MAX=2",
          ...(engine === "chromium" ? [] : ["-e", `SETUP_CODE=${code}`]),
          image,
        );
        const app = JSON.parse(await docker("inspect", name))[0];
        const base = `http://localhost:${app.NetworkSettings.Ports["3000/tcp"][0].HostPort}`;
        await eventually(
          () => fetch(base + "/api/health").then((response) => response.status),
          (value) => value === 200,
        );
        if (engine === "chromium") {
          const logs = await docker("logs", name);
          const generated = logs.match(
            /Setup code \(keep private\): ([a-f0-9]{64})/,
          );
          assert(
            generated,
            "Private startup log must contain the generated setup code",
          );
          code = generated[1];
        }
        const browser = await launcher.launch({
          env: toolEnvironment() as Record<string, string>,
        });
        try {
          return await browserContracts(
            browser,
            base,
            code,
            address.port,
            resolve(artifacts, "auth-" + engine + ".png"),
          );
        } catch (error) {
          // Never persist auth headers, passwords, setup codes or request bodies.
          await writeFile(
            resolve(artifacts, "auth-" + engine + "-failure.txt"),
            String(error)
              .replaceAll(code, "[redacted]")
              .replaceAll(fixturePassword, "[redacted]"),
          );
          throw error;
        } finally {
          await browser.close();
        }
      });
    }
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    try {
      await check("auth/cleanup", async () => {
        const failures: unknown[] = [];
        const actions = [
          () => pool?.end(),
          () =>
            new Promise<void>((yes, no) => {
              if (!server.listening) return yes();
              server.close((error) => (error ? no(error) : yes()));
            }),
          ...containers.reverse().map((name) => async () => {
            assert(name.startsWith(project + "-"));
            await docker("rm", "-f", "--volumes", name);
          }),
          ...(network ? [() => docker("network", "rm", project)] : []),
        ];
        for (const action of actions)
          try {
            await action();
          } catch (error) {
            failures.push(error);
          }
        if (failures.length)
          throw new AggregateError(
            failures,
            "Authentication fixture cleanup failed",
          );
        return { ownedContainers: containers.length, networkRemoved: network };
      });
    } catch (cleanup) {
      if (primary)
        throw new AggregateError(
          [primary, cleanup],
          "Authentication checks and cleanup failed",
        );
      throw cleanup;
    }
  }
}
