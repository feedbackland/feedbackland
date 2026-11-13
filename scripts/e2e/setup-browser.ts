import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import { toolEnvironment } from "./run";
export const fixturePassword = "Fixture-password-42";
export async function submitSetup(
  page: Page,
  base: string,
  code: string,
  email = "admin@fixture.invalid",
) {
  assert.equal(
    (await page.request.get(base + "/api/auth/get-session")).status(),
    200,
    "Auth HTTP route must respond before setup",
  );
  await page.goto(base);
  await page.waitForURL(base + "/setup");
  await page.getByLabel("Setup code", { exact: true }).fill(code);
  await page.getByLabel("Board name", { exact: true }).fill("Fixture board");
  await page.getByLabel("Your name", { exact: true }).fill("Fixture admin");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(fixturePassword);
  const setupReply = page.waitForResponse(
    (response) =>
      response.url().startsWith(base) &&
      response.request().method() === "POST" &&
      !!response.request().headers()["next-action"],
  );
  await page.getByRole("button", { name: "Create board", exact: true }).click();
  const setCookies = (await (await setupReply).headersArray())
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value);
  assert(
    setCookies.some(
      (cookie) =>
        cookie.includes("better-auth.session_token=") &&
        /;\s*HttpOnly/i.test(cookie) &&
        /;\s*SameSite=Lax/i.test(cookie),
    ),
    "Setup response must set an HttpOnly SameSite=Lax session cookie",
  );
  await page.waitForURL((url) => url.pathname === "/admin/activity", {
    timeout: 30_000,
  });
  await page.getByRole("link", { name: "Home", exact: true }).waitFor();
  const cookies = await page.context().cookies(base);
  const session = cookies.find((cookie) =>
    cookie.name.endsWith("better-auth.session_token"),
  );
  assert(
    session?.httpOnly,
    "Setup must establish the first-party session: " +
      JSON.stringify(
        cookies.map(({ name, httpOnly, sameSite, secure, domain }) => ({
          name,
          httpOnly,
          sameSite,
          secure,
          domain,
        })),
      ),
  );
  assert(
    !(await page.evaluate(() => document.cookie)).includes("session_token"),
  );
}
/** Used by cumulative fixtures: claim through the rendered form, never SQL. */
export async function claimSetup(base: string, code: string) {
  const browser = await chromium.launch({
    env: toolEnvironment() as Record<string, string>,
  });
  try {
    const page = await browser.newPage();
    const observations: unknown[] = [];
    const pending: Promise<void>[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/auth/get-session"))
        pending.push(
          (async () => {
            try {
              const d = await response.json();
              observations.push({
                url: response.url(),
                status: response.status(),
                role: d?.user?.role,
                scope: d?.session?.scope,
                createdAt: d?.session?.createdAt,
              });
            } catch {
              observations.push({ status: response.status() });
            }
          })(),
        );
    });
    try {
      await submitSetup(page, base, code);
    } catch (error) {
      await Promise.allSettled(pending);
      const current = await page.evaluate(async () => {
        const r = await fetch("/api/auth/get-session", {
          credentials: "include",
        });
        const text = await r.text();
        const d = text ? JSON.parse(text) : null;
        return {
          status: r.status,
          empty: !text,
          now: Date.now(),
          role: d?.user?.role,
          scope: d?.session?.scope,
          createdAt: d?.session?.createdAt,
          expiresAt: d?.session?.expiresAt,
          matching: d?.user?.id === d?.session?.userId,
        };
      });
      throw new Error(
        String(error) +
          "\n" +
          JSON.stringify({
            url: page.url(),
            observations,
            current,
            body: await page.locator("body").innerText(),
          }),
      );
    }
  } finally {
    await browser.close();
  }
}
