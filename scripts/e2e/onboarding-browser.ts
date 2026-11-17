import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import { eventually, toolEnvironment } from "./run";
import { submitSetup, fixturePassword } from "./setup-browser";
import { fixtureKey } from "./onboarding-provider";
type Fixture = {
  secure: string;
  lan: string;
  auth: string;
  setup: string;
  certificatePin: string;
  sql: (query: string) => Promise<string>;
  setCredit: (available: boolean) => Promise<void>;
};
export async function onboardingBrowser(f: Fixture) {
  const browser = await chromium.launch({
    env: toolEnvironment() as Record<string, string>,
    args: [
      "--no-proxy-server",
      "--ignore-certificate-errors-spki-list=" + f.certificatePin,
      "--host-resolver-rules=MAP openrouter.ai:443 127.0.0.1:" +
        f.auth +
        ", MAP board.test 127.0.0.1",
    ],
  });
  const primary = "https://localhost:" + f.secure,
    publicBoard = "https://board.test:" + f.secure,
    lan = "http://127.0.0.1:" + f.lan;
  const path = "/admin/settings/ai";
  const context = await browser.newContext();
  const page = await context.newPage(),
    peer = await browser.newPage(),
    drawer = await browser.newPage();
  const heading = (p: Page, name: string) =>
    p.getByRole("heading", { name, exact: true });
  const button = (p: Page, name: string) =>
    p.getByRole("button", { name, exact: true }).last();
  const link = (p: Page, name: string) =>
    p.getByRole("link", { name, exact: true });
  const on = (p: Page) => heading(p, "AI on").waitFor({ timeout: 25000 });
  const off = (p: Page) => heading(p, "AI off").waitFor({ timeout: 25000 });
  const improve = button(drawer, "Improve my draft");
  const auth = async (p: Page, base: string, op: string, email: string) => {
    await p.goto(base);
    return p.evaluate(
      async ({ op, email, password }) =>
        (
          await fetch("/api/auth/" + op, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              password,
              name: "Second administrator",
            }),
          })
        ).status,
      { op, email, password: fixturePassword },
    );
  };
  // Guard against accidental page replacement while visibility and status change.
  const mark = async (p: Page) =>
    p.evaluate(() => {
      document.documentElement.dataset.onboardingInstance = "mounted";
    });
  const mounted = async (p: Page) =>
    assert.equal(
      await p.locator("html").getAttribute("data-onboarding-instance"),
      "mounted",
    );
  const paste = async (p: Page, value: string) => {
    const input = p.getByLabel("OpenRouter key", { exact: true });
    if (!(await input.isVisible()))
      await p
        .getByText(/Paste a new key|Already have an OpenRouter key\? Paste it/)
        .click();
    await input.evaluate((node, text) => {
      const data = new DataTransfer();
      data.setData("text", text);
      node.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
    }, value);
  };
  let step = "setup";
  try {
    await submitSetup(page, primary, f.setup, "admin@fixture.invalid", true);
    assert.equal(
      await auth(
        peer,
        publicBoard,
        "sign-up/email",
        "onboarding-peer@example.invalid",
      ),
      200,
    );
    await f.sql(
      "update \"user\" set role='admin' where email='onboarding-peer@example.invalid'",
    );
    assert.equal(
      await auth(
        peer,
        publicBoard,
        "sign-in/email",
        "onboarding-peer@example.invalid",
      ),
      200,
    );
    await peer.goto(publicBoard + path);
    await off(peer);
    await mark(peer);
    await drawer.goto(publicBoard + "/?embed=drawer");
    await drawer
      .getByRole("textbox", { name: "Your feedback" })
      .fill("Keep this visitor draft");
    await mark(drawer);
    assert(!(await improve.isVisible()));
    await page.goto(primary + path);
    await off(page);
    step = "HTTPS redirect with PKCE";
    await button(page, "Connect OpenRouter").click();
    await page.waitForURL((u) => u.hostname === "openrouter.ai");
    const url = new URL(page.url());
    const callback = new URL(url.searchParams.get("callback_url")!);
    assert.equal(callback.origin, primary);
    assert.equal(
      callback.pathname.split("/").at(-1),
      url.searchParams.get("state"),
    );
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    const pending = (await context.cookies(primary)).find(
      (c) => c.name === "feedbackland.openrouter",
    );
    assert(
      pending?.httpOnly && pending.secure && pending.value.startsWith("v1."),
    );
    await link(page, "Authorize").click();
    await on(page);
    assert.equal(new URL(page.url()).search, "");
    assert(
      !(await context.cookies(primary)).some(
        (c) => c.name === "feedbackland.openrouter",
      ),
    );
    await on(peer);
    await improve.waitFor({ timeout: 20000 });
    await mounted(peer);
    await mounted(drawer);
    const confirmed = link(page, "Confirm it’s yours");
    assert.match(
      (await confirmed.getAttribute("href"))!,
      /^https:\/\/openrouter\.ai\/keys\/[0-9a-f]{64}$/,
    );
    step = "budget, UTC rollover and stale drawer";
    await f.sql(
      "insert into rate_limit(key,count) values('ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'),5000) on conflict(key) do update set count=5000",
    );
    await heading(peer, "AI paused").waitFor({ timeout: 18000 });
    await improve.waitFor({ state: "hidden", timeout: 18000 });
    await f.sql(
      "update rate_limit set key='ai:instance:day:'||to_char((clock_timestamp() at time zone 'UTC')-interval '1 day','YYYY-MM-DD') where key='ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')",
    );
    await on(peer);
    await improve.waitFor({ timeout: 18000 });
    await mounted(peer);
    await mounted(drawer);
    await drawer.context().setOffline(true);
    await improve.waitFor({ state: "hidden", timeout: 36000 });
    await drawer.context().setOffline(false);
    await improve.waitFor({ timeout: 15000 });
    assert.equal(
      await drawer.getByRole("textbox", { name: "Your feedback" }).innerText(),
      "Keep this visitor draft",
    );
    await mounted(drawer);
    step = "capability-specific failure and recovery";
    const activity = await context.newPage();
    await activity.goto(primary + "/admin/activity");
    await f.sql(
      `insert into ai_health("configToken",capability,"failingSince","lastFailureAt","lastReason") select "effectiveConfigToken",'embeddings',clock_timestamp()-interval '16 minutes',clock_timestamp(),'provider-rate' from ai_settings where id=1 on conflict("configToken",capability) do update set "failingSince"=excluded."failingSince","lastFailureAt"=excluded."lastFailureAt","lastReason"=excluded."lastReason"`,
    );
    const warning = link(peer, "AI needs attention");
    await warning.waitFor({ timeout: 18000 });
    assert(
      await warning.evaluate((el) => el.classList.contains("text-destructive")),
    );
    await activity
      .getByText(/Search has used exact words since/)
      .waitFor({ timeout: 18000 });
    assert(await improve.isVisible());
    await mounted(drawer);
    await f.sql(
      `insert into ai_health("configToken",capability,"failingSince","lastFailureAt","lastReason") select "effectiveConfigToken",'chat',clock_timestamp()-interval '17 minutes',clock_timestamp(),'provider-rate' from ai_settings where id=1 on conflict("configToken",capability) do update set "failingSince"=excluded."failingSince","lastFailureAt"=excluded."lastFailureAt","lastReason"=excluded."lastReason"`,
    );
    await improve.waitFor({ state: "hidden", timeout: 18000 });
    await activity
      .getByText(/OpenRouter chat has been failing since/)
      .waitFor({ timeout: 18000 });
    await activity
      .getByText("0 items were published without full screening.")
      .waitFor();
    await button(activity, "Not now").click();
    await heading(activity, "OpenRouter needs attention").waitFor({
      state: "hidden",
    });
    await f.sql(
      `update ai_health set "failingSince"=null,"lastReason"=null,"lastSuccessAt"=clock_timestamp() where "configToken"=(select "effectiveConfigToken" from ai_settings where id=1)`,
    );
    await on(peer);
    await improve.waitFor({ timeout: 18000 });
    await mounted(peer);
    await mounted(drawer);
    await activity.close();
    step = "Keep off, retained key and undo";
    await button(page, "Turn off AI").click();
    await off(page);
    await off(peer);
    await improve.waitFor({ state: "hidden", timeout: 18000 });
    await button(page, "Turn on AI").click();
    await on(page);
    await on(peer);
    await button(page, "Remove key").click();
    await off(page);
    await off(peer);
    await paste(page, "sk-ant-wrong");
    await page
      .getByText(/This is a Anthropic key|This is an Anthropic key/)
      .waitFor();
    await paste(page, fixtureKey);
    await on(page);
    await on(peer);
    await button(page, "Undo").click();
    await off(page);
    await off(peer);
    step = "configured public HTTPS redirect";
    await f.sql('update settings set "allowIndexing"=true');
    await peer
      .getByText(/OpenRouter will show this board/)
      .waitFor({ timeout: 15000 });
    await Promise.all([
      peer.waitForURL((u) => u.hostname === "openrouter.ai"),
      button(peer, "Connect OpenRouter").click(),
    ]);

    assert.equal(
      new URL(new URL(peer.url()).searchParams.get("callback_url")!).origin,
      publicBoard,
    );
    await peer.goto(publicBoard + path);
    await f.sql('update settings set "allowIndexing"=false');
    await peer
      .getByText(/OpenRouter will show this board/)
      .waitFor({ state: "hidden", timeout: 18000 });
    step = "private HTTPS headless";
    const hiddenFlow = peer.waitForEvent("popup");
    await button(peer, "Connect OpenRouter").click();
    const privatePopup = await hiddenFlow;
    await privatePopup.waitForURL((u) => u.hostname === "openrouter.ai");
    assert(!new URL(privatePopup.url()).searchParams.has("callback_url"));
    await privatePopup.close();
    step = "private HTTP headless";
    const lanPage = await browser.newPage();
    assert.equal(
      await auth(lanPage, lan, "sign-in/email", "admin@fixture.invalid"),
      200,
    );
    await lanPage.goto(lan + path);
    await off(lanPage);
    const popped = lanPage.waitForEvent("popup");
    await button(lanPage, "Connect OpenRouter").click();
    const popup = await popped;
    await popup.waitForURL((u) => u.hostname === "openrouter.ai");
    assert(!new URL(popup.url()).searchParams.has("callback_url"));
    assert(!new URL(popup.url()).searchParams.has("state"));
    const field = lanPage.getByLabel("Paste the code OpenRouter shows you", {
      exact: true,
    });
    await field.waitFor();
    await eventually(
      () => field.evaluate((el) => el === document.activeElement),
      Boolean,
      3000,
    );
    await button(popup, "Authorize").click();
    const code = await popup.locator("output").innerText();
    await field.evaluate((node, text) => {
      const data = new DataTransfer();
      data.setData("text", text);
      node.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
    }, code);
    await on(lanPage);
    await on(page);
    await popup.close();
    step = "foreground credit polling";
    await lanPage.close();
    await peer.close();
    const visiblePoll = () =>
      page.waitForResponse(
        (response) =>
          response.status() === 200 &&
          response.url().includes("changeAiKey") &&
          !!response.request().postData()?.includes('"action":"credit"'),
        { timeout: 65000 },
      );
    await f.setCredit(false);
    await paste(page, fixtureKey);
    await heading(page, "AI: add credit").waitFor();
    assert(
      !(await link(page, "AI: add credit").evaluate((el) =>
        el.classList.contains("text-destructive"),
      )),
    );
    // Observe a regular page check while credit is still absent. This prevents
    // the leader's immediate check on a new configuration from passing this leg.
    await visiblePoll();
    await Promise.all([visiblePoll(), f.setCredit(true)]);
    await on(page);
    step = "closed-page scheduled credit check";
    const failedChecks = async () =>
      Number(
        await f.sql(
          "select coalesce(sum(errors),0) from llm_usage where feature='check'",
        ),
      );
    const baseline = await failedChecks();
    await f.setCredit(false);
    await paste(page, fixtureKey);
    await heading(page, "AI: add credit").waitFor();
    await page.close();
    // The initial live check and the leader must each observe the unpaid
    // account. Only the next scheduled leadership tick can enable it now.
    await eventually(failedChecks, (n) => n >= baseline + 2, 320000);
    assert.equal(
      await f.sql("select enabled is null from ai_settings where id=1"),
      "t",
    );
    await f.setCredit(true);
    await eventually(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return f.sql("select enabled from ai_settings where id=1");
      },
      (r) => r === "t",
      320000,
    );
    await improve.waitFor({ timeout: 20000 });
    await mounted(drawer);
  } catch (e) {
    const alerts = (
      await Promise.all(
        [page, peer]
          .filter((p) => !p.isClosed())
          .map((p) => p.getByRole("alert").allTextContents()),
      )
    )
      .flat()
      .filter(Boolean)
      .join(" ")
      .slice(0, 300);
    throw new Error("P11 browser failed during " + step + " " + alerts, {
      cause: e,
    });
  } finally {
    await browser.close();
  }
}
