import assert from "node:assert/strict";
import { chromium, type Page, type FrameLocator } from "playwright";
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
  control: (path: string) => Promise<{
    mode: string;
    samples: { at: number; kind: string; images: number }[];
  }>;
  setCredit: (available: boolean) => Promise<number>;
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
  const context = await browser.newContext(),
    peerContext = await browser.newContext();
  const page = await context.newPage(),
    peer = await peerContext.newPage(),
    host = await peer.context().newPage(),
    drawer = host.frameLocator('iframe[title="Feedback drawer"]');
  const heading = (p: Page, name: string) =>
    p.getByRole("heading", { name, exact: true });
  const button = (p: Page | FrameLocator, name: string) =>
    p.getByRole("button", { name, exact: true }).last();
  const link = (p: Page, name: string) =>
    p.getByRole("link", { name, exact: true });
  const on = (p: Page) => heading(p, "AI on").waitFor({ timeout: 10500 });
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
  const mark = async (p: Page | FrameLocator) =>
    p.locator("html").evaluate(() => {
      document.documentElement.dataset.onboardingInstance = "mounted";
    });
  const mounted = async (p: Page | FrameLocator) =>
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
    await host.goto(lan + "/fixture-parent?port=" + f.secure);
    await mark(host);
    await host.evaluate(() =>
      localStorage.setItem("fixture-parent", "mounted"),
    );
    await drawer
      .getByText("Post anonymously, or sign in to manage your feedback.")
      .waitFor();
    assert((await peer.context().cookies(publicBoard)).some((c) => c.httpOnly));
    assert(
      await drawer
        .locator("html")
        .evaluate(
          () =>
            parent !== window &&
            localStorage.getItem("fixture-parent") === null,
        ),
    );
    await f.sql(`with old as (insert into feedback(title,description,"plainText","moderationState") values('Original title','Old fixture post','Old fixture post','disabled') returning id)
      insert into comment("postId",content,"plainText","moderationState") select id,'Old fixture reply','Old fixture reply','disabled' from old`);
    assert.equal(
      await f.sql(
        "select count(*) from feedback where title='Original title' and embedding is null",
      ),
      "1",
    );
    await drawer
      .getByRole("textbox", { name: "Your feedback" })
      .fill("Keep this visitor draft");
    await mark(drawer);
    assert(!(await improve.isVisible()));
    await page.goto(primary + path);
    await off(page);
    step = "collapsed index queries";
    let counts = 0;
    page.on("request", (request) => {
      if (request.url().includes("getSearchIndex")) counts++;
    });
    await page.waitForTimeout(5500);
    assert.equal(counts, 0);
    const advanced = page.getByText("Advanced settings and privacy", {
      exact: true,
    });
    await advanced.click();
    await eventually(
      async () => counts,
      (n) => n > 0,
      3000,
    );
    await page.getByText("What is sent to OpenRouter", { exact: true }).click();
    await page
      .getByText(/up to 4 eligible images.+unpublished draft text/)
      .waitFor();
    await page
      .getByText("Large-request scenario at listed prices", { exact: true })
      .click();
    await page
      .getByText(
        /Moderation · image request and text-only fallback.+2 attempts/,
      )
      .waitFor();
    await page
      .getByText(
        /Backfill · rejected inputs and split retries.+fixed control succeeds/,
      )
      .waitFor();
    await advanced.click();
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
      (c) =>
        c.name === "feedbackland.openrouter." + url.searchParams.get("state"),
    );
    assert(
      pending?.httpOnly && pending.secure && pending.value.startsWith("v1."),
    );
    const capabilities = async (value: boolean, start = performance.now()) => {
      const timings = await Promise.all(
        [page, peer].map(async (tab) => {
          const response = await eventually(
            async () => {
              const before = performance.now();
              const body = await tab.evaluate(async () =>
                (await fetch("/api/settings", { cache: "no-store" })).json(),
              );
              return {
                match:
                  body.capabilities.chat === value &&
                  body.capabilities.embeddings === value,
                wire: performance.now() - before,
              };
            },
            (x) => x.match,
            5600,
          );
          return { elapsed: performance.now() - start, wire: response.wire };
        }),
      );
      for (const t of timings)
        assert(
          t.elapsed <= 5000 + t.wire + 350,
          "replica convergence " + JSON.stringify(t),
        );
    };
    const authorized = page.waitForResponse(
      (r) => r.url().includes("finishOpenRouter") && r.status() === 200,
    );
    await link(page, "Authorize").click();
    await authorized;
    const committed = performance.now();
    await Promise.all([
      capabilities(true, committed),
      on(page),
      on(peer),
      improve.waitFor({ timeout: 10500 }),
    ]);
    assert(
      performance.now() - committed < 10500,
      "mounted controls missed the ten-second refresh",
    );
    assert.equal(new URL(page.url()).search, "");
    assert(
      !(await context.cookies(primary)).some(
        (c) =>
          c.name === "feedbackland.openrouter." + url.searchParams.get("state"),
      ),
    );
    await on(peer);
    await improve.waitFor({ timeout: 10500 });
    await mounted(peer);
    await mounted(drawer);
    const confirmed = link(page, "Confirm it’s yours");
    assert.match(
      (await confirmed.getAttribute("href"))!,
      /^https:\/\/openrouter\.ai\/keys\/[0-9a-f]{64}$/,
    );
    step = "publication and existing-content backfill";

    const text = drawer.getByRole("textbox", { name: "Your feedback" });
    const trace = host.waitForRequest(
      (req) =>
        req.url().includes("createFeedbackPost") && req.method() === "POST",
    );
    await button(drawer, "Submit feedback").click();
    const sent = await trace;
    assert.equal(await sent.headerValue("cookie"), null);
    assert.equal(await sent.headerValue("authorization"), null);
    await eventually(
      () =>
        f.sql(
          "select title||'|'||category||'|'||\"moderationState\"||'|'||(\"authorId\" is null) from feedback where \"plainText\"='Keep this visitor draft'",
        ),
      (v) => v === "Fixture navigation proposal|idea|screened|true",
      6000,
    );
    await text.fill("Keep this visitor draft");
    await eventually(
      () =>
        f.sql(`select
      (select count(*) from feedback where title='Original title' and "moderationState"='disabled' and embedding is not null)
      +(select count(*) from comment where "plainText"='Old fixture reply' and "moderationState"='disabled' and embedding is not null)`),
      (v) => v === "2",
      20000,
    );
    await peer.getByText(/Search index: 3 of 3/).waitFor({ timeout: 12000 });
    const samples = (await f.control("/samples")).samples;
    assert(
      samples.some((x) => x.kind === "title") &&
        samples.some((x) => x.kind === "moderation"),
    );

    step = "Ask AI draft, failed status refresh and stale drawer";
    const ask = await context.newPage();
    await ask.goto(primary + "/admin/ask-ai");
    const composer = ask.getByPlaceholder("Ask about your feedback…");
    await composer.fill("Which changes helped visitors?");
    await mark(ask);
    await f.sql(
      "insert into rate_limit(key,count) values('ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'),5000) on conflict(key) do update set count=5000",
    );
    await Promise.all([
      heading(peer, "AI paused").waitFor({ timeout: 10500 }),
      improve.waitFor({ state: "hidden", timeout: 10500 }),
      composer.waitFor({ state: "hidden", timeout: 10500 }),
    ]);
    await f.sql(
      "update rate_limit set count=0 where key='ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')",
    );
    await on(peer);
    await composer.waitFor();
    assert.equal(await composer.inputValue(), "Which changes helped visitors?");
    await ask.route("**/*getAiStatus*", (route) => route.abort());
    await ask.evaluate(() => window.dispatchEvent(new Event("focus")));
    await composer.waitFor({ state: "hidden", timeout: 12000 });
    await ask.unroute("**/*getAiStatus*");
    await ask.evaluate(() => window.dispatchEvent(new Event("focus")));
    await composer.waitFor({ timeout: 31000 });
    assert.equal(await composer.inputValue(), "Which changes helped visitors?");
    await mounted(ask);
    await ask.close();
    await host.route("**/api/settings", (route) => route.abort());
    await improve.waitFor({ state: "hidden", timeout: 36000 });
    await host.unroute("**/api/settings");
    await improve.waitFor({ timeout: 15000 });
    assert.equal(await text.innerText(), "Keep this visitor draft");

    step = "embedding check across both replicas";
    await f.control("/mode?value=width");
    await button(page, "Test again").click();
    await page.getByText(/Model returned 2 dimensions/).waitFor();
    const semantic = async (p: Page) =>
      (await p.evaluate(
        async () =>
          (await (await fetch("/api/settings")).json()).capabilities.embeddings,
      )) as boolean;
    for (const p of [page, peer]) assert.equal(await semantic(p), false);
    await f.control("/mode?value=paid");
    await Promise.all(
      [page, peer].map((p) => eventually(() => semantic(p), Boolean, 40000)),
    );
    // Recheck the provider after both replicas independently obtained a good probe.
    const result = await page.evaluate(async () => {
      const state = (await (await fetch("/api/trpc/getAiStatus")).json()).result
        .data.json;
      return (
        await fetch("/api/trpc/changeAiKey", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            json: { identity: state.identity, action: "test-again" },
          }),
        })
      ).status;
    });
    assert.equal(result, 200);
    await on(page);
    step = "real capability failures and ordinary recovery";
    const activity = await context.newPage();
    await activity.goto(primary + "/admin/activity");
    await f.control("/mode?value=embedding-rate");
    await text.fill("Indexing recovery fixture");
    await button(drawer, "Submit feedback").click();
    const health = (cap: string) =>
      f.sql(
        `select coalesce("lastReason",'recovered') from ai_health where "configToken"=(select "effectiveConfigToken" from ai_settings) and capability='${cap}'`,
      );
    await eventually(
      () => health("embeddings"),
      (v) => v === "provider-rate",
      15000,
    );
    const age = async (
      cap: string,
      field: "failingSince" | "lastFailureAt",
      minutes: number,
    ) =>
      f.sql(
        `update ai_health set "${field}"=clock_timestamp()-interval '${minutes} minutes' where "configToken"=(select "effectiveConfigToken" from ai_settings) and capability='${cap}' and "lastReason" is not null`,
      );
    await age("embeddings", "failingSince", 16);
    await activity
      .getByText(/Search has used exact words since/)
      .waitFor({ timeout: 10500 });
    await text.fill("Keep this visitor draft");
    await f.control("/mode?value=rate");
    await improve.click();
    await eventually(
      () => health("chat"),
      (v) => v === "provider-rate",
      5000,
    );
    await age("chat", "failingSince", 17);
    await improve.waitFor({ state: "hidden", timeout: 10500 });
    await activity
      .getByText(/OpenRouter chat has been failing since/)
      .waitFor({ timeout: 10500 });
    await button(activity, "Not now").click();
    await heading(activity, "OpenRouter needs attention").waitFor({
      state: "hidden",
    });
    await f.control("/mode?value=paid");
    await age("chat", "lastFailureAt", 11);
    await age("embeddings", "lastFailureAt", 11);
    await improve.click({ timeout: 12000 });
    await eventually(
      () => health("chat"),
      (v) => v === "recovered",
      5000,
    );
    await eventually(() => semantic(peer), Boolean, 45000);
    await text.fill("Fresh content after the provider recovered");
    await button(drawer, "Submit feedback").click();
    await eventually(
      () => health("embeddings"),
      (v) => v === "recovered",
      25000,
    );
    await on(peer);
    await text.fill("Keep this visitor draft");
    await mounted(peer);
    await mounted(drawer);
    await mounted(host);
    await activity.close();

    step = "Advanced pending save";
    await advanced.click();
    const limit = page.getByLabel("Daily model request limit");
    const timeout = page.getByLabel("Request timeout (ms)");
    const inFlight = Promise.withResolvers<void>(),
      release = Promise.withResolvers<void>();
    await page.route("**/*saveAiOptions*", async (route) => {
      inFlight.resolve();
      await release.promise;
      await route.continue();
    });
    await limit.fill("5010");
    await button(page, "Save AI settings").click();
    try {
      await inFlight.promise;
      assert(await timeout.isDisabled());
    } finally {
      release.resolve();
    }
    await page.getByText("AI settings saved.", { exact: true }).waitFor();
    await page.unroute("**/*saveAiOptions*");
    step = "embedding model change with an existing index";
    const model = page.getByLabel("Embedding model", { exact: true });
    const originalModel = await model.inputValue();
    await model.fill("openai/text-embedding-3-large");
    await button(page, "Save AI settings").click();
    await link(page, "Review search index").waitFor();
    await page.getByText(/Search passed/).waitFor();
    assert.equal(
      await page
        .getByRole("progressbar", { name: "Search indexing progress" })
        .count(),
      0,
    );
    await model.fill(originalModel);
    await button(page, "Save AI settings").click();
    await on(page);
    await advanced.click();

    step = "rotated key and mounted expiry";
    await f.control(
      "/mode?value=paid&rotation=second&expiry=" +
        encodeURIComponent(new Date(Date.now() + 18000).toISOString()),
    );
    await paste(page, fixtureKey + "2222");
    await page.getByText(/Stored key ending in …2222/).waitFor();
    await page.getByText("This key expires within seven days.").waitFor();
    await heading(peer, "AI needs attention").waitFor({ timeout: 25000 });
    await improve.waitFor({ state: "hidden", timeout: 10500 });
    await f.control("/mode?value=paid&expiry=");
    await paste(page, fixtureKey);
    await on(peer);
    await improve.waitFor({ timeout: 10500 });
    assert.equal(await text.innerText(), "Keep this visitor draft");
    step = "Keep off, retained key and undo";
    const lifecycle = await peer.context().newCDPSession(peer);
    await lifecycle.send("Page.setWebLifecycleState", { state: "frozen" });
    await button(page, "Turn off AI").click();
    await off(page);
    await lifecycle.send("Page.setWebLifecycleState", { state: "active" });
    await peer.bringToFront();
    await peer.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await Promise.all([capabilities(false), off(peer)]);
    await lifecycle.detach();
    await improve.waitFor({ state: "hidden", timeout: 10500 });
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
    for (const surface of ["header", "Activity"] as const) {
      for (const listed of [false, true]) {
        await peer.goto(publicBoard + "/admin/activity");
        const group =
          surface === "header"
            ? peer.locator("div.my-3").filter({
                has: peer.getByRole("link", { name: "AI off", exact: true }),
              })
            : peer
                .locator("section")
                .filter({ has: heading(peer, "Let the board do the sorting") });
        await group.getByText(/OpenRouter will show this board/).waitFor();
        if (listed) {
          await group
            .getByRole("button", { name: "Connect OpenRouter", exact: true })
            .click();
          await peer.waitForURL((u) => u.hostname === "openrouter.ai");
          assert.equal(
            new URL(new URL(peer.url()).searchParams.get("callback_url")!)
              .origin,
            publicBoard,
          );
        } else {
          const opened = peer.waitForEvent("popup");
          await group
            .getByRole("button", { name: "Connect without listing" })
            .click();
          const child = await opened;
          await child.waitForURL((u) => u.hostname === "openrouter.ai");
          assert.equal(
            new URL(child.url()).searchParams.has("callback_url"),
            false,
          );
          await child.close();
        }
      }
    }
    await peer.goto(publicBoard + path);
    await off(peer);
    await peer.getByText(/OpenRouter will show this board/).waitFor();
    await f.sql('update settings set "allowIndexing"=false');
    await peer
      .getByText(/OpenRouter will show this board/)
      .waitFor({ state: "hidden", timeout: 10500 });
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
    await peer.goto(publicBoard + path);
    await on(peer);
    step = "funding an already enabled key";
    await f.setCredit(false);
    await button(page, "Test again").click();
    await heading(page, "AI needs attention").waitFor();
    await link(page, "Add credit on OpenRouter").waitFor();
    await f.setCredit(true);
    await button(page, "Test again").click();
    await on(page);
    // Age only the existing observation. Subsequent metadata responses use the real mutation and provider.
    step = "spend limit freshness";
    await f.sql(
      `update ai_settings set "lastCheck"=jsonb_set("lastCheck",'{at}',to_jsonb((clock_timestamp()-interval '16 minutes')::text))`,
    );
    await page
      .getByText(/Provider spend limit.*monthly.*remaining.*12.5/)
      .waitFor();
    const spendContext = await browser.newContext({
      storageState: await context.storageState(),
    });
    const spendTab = await spendContext.newPage();
    await spendTab.clock.install();
    await spendTab.goto(primary + path);
    await spendTab
      .getByText(/Provider spend limit.*monthly.*remaining.*12.5/)
      .waitFor();
    await f.control("/mode?value=paid&balance=8.75");
    await spendTab.clock.fastForward(15 * 60000 + 1000);
    await spendTab
      .getByText(/Provider spend limit.*monthly.*remaining.*8.75/)
      .waitFor({ timeout: 10000 });
    await spendContext.close();
    step = "foreground timing across two replicas";
    const isPoll = (req: {
      url: () => string;
      postData: () => string | null;
    }) =>
      req.url().includes("changeAiKey") &&
      !!req.postData()?.includes('"action":"credit"');
    const activityByTab = [0, 0];
    for (const [i, p] of [page, peer].entries())
      p.on("request", (req) => {
        if (isPoll(req)) activityByTab[i]++;
      });
    let delayed = false;
    await page.route("**/*changeAiKey*", async (route) => {
      if (!delayed && isPoll(route.request())) {
        delayed = true;
        await new Promise((r) => setTimeout(r, 2500));
      }
      await route.continue();
    });
    const startCredit = Date.now();
    await f.setCredit(false);
    await paste(page, fixtureKey);
    await heading(page, "AI: add credit").waitFor();
    assert(
      !(await link(page, "AI: add credit").evaluate((el) =>
        el.classList.contains("text-destructive"),
      )),
    );
    const polls = async () =>
      JSON.parse(
        await f.sql(
          `select coalesce(json_agg(extract(epoch from at)*1000 order by at),'[]') from onboarding_clock.poll where at>=to_timestamp(${startCredit}/1000.0)`,
        ),
      ) as number[];
    const observed = await eventually(polls, (arr) => arr.length >= 5, 82000);
    assert(
      delayed && activityByTab.every((n) => n >= 1),
      "both tabs participate",
    );
    for (let i = 1; i < observed.length; i++)
      assert(
        observed[i] - observed[i - 1] >= 15000,
        "early database admission",
      );
    for (let i = 4; i < observed.length; i++)
      assert(
        observed[i] - observed[i - 4] >= 60000,
        "five polls within a minute",
      );
    const wire = (await f.control("/samples")).samples.filter(
      (x) => x.kind === "check" && x.at >= startCredit,
    );
    // The installation has its own initial check. All later model requests must have one database poll.
    assert(wire.length === observed.length + 1);
    for (let i = 0; i < observed.length; i++)
      assert(Math.abs(wire[i + 1].at - observed[i]) < 1200);
    const visible = Promise.all(
      [page, peer].map(async (tab) => {
        await tab.waitForFunction(
          () =>
            Array.from(document.querySelectorAll("h2")).some(
              (h) => h.textContent === "AI on",
            ),
          undefined,
          { polling: 25, timeout: 17000 },
        );
        return Date.now();
      }),
    );
    const fundedAt = await f.setCredit(true);
    const visibleAt = await visible;
    const activatedAt = Number(
      await f.sql(
        'select extract(epoch from "updatedAt")*1000 from ai_settings where enabled',
      ),
    );
    const activationMs = activatedAt - fundedAt;
    const fundedMs = Math.max(...visibleAt) - fundedAt;
    assert(
      activationMs >= 0 && activationMs <= 15000,
      "funding to committed activation took " + activationMs + "ms",
    );
    assert(
      fundedMs - activationMs <= 1000,
      "status delivery to both mounted tabs took " +
        (fundedMs - activationMs) +
        "ms",
    );
    await page.unroute("**/*changeAiKey*");
    await peer.close();
    step = "closed-page scheduled credit check";
    const failedChecks = async () =>
      Number(
        await f.sql(
          "select coalesce(sum(errors),0) from llm_usage where feature='check'",
        ),
      );
    // Start this independent wait after the preceding key's poll admission has cooled down.
    await page.waitForTimeout(15100);
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
    const closedStart = performance.now();
    await eventually(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return f.sql("select enabled from ai_settings where id=1");
      },
      (r) => r === "t",
      310000,
    );
    await improve.waitFor({ timeout: 10500 });
    await mounted(drawer);
    const closedCreditMs = Math.round(performance.now() - closedStart);
    step = "UTC midnight with both allowances exhausted on a mounted board";
    const midnightTab = await context.newPage();
    await midnightTab.goto(primary + path);
    await on(midnightTab);
    await mark(midnightTab);
    const daySql = "to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')";
    await f.sql(
      `update onboarding_clock.settings set delta=(date_trunc('day',pg_catalog.clock_timestamp() at time zone 'UTC') at time zone 'UTC')+interval '1 day'-interval '45 seconds'-pg_catalog.clock_timestamp()`,
    );
    const oldDay = await f.sql("select " + daySql),
      ordinary = 5010;
    await f.sql(
      `insert into rate_limit(key,count) values('ai:instance:day:'||${daySql},${ordinary}),('ai:instance:day:diagnostic:'||${daySql},40) on conflict(key) do update set count=excluded.count`,
    );
    await heading(midnightTab, "AI paused").waitFor({ timeout: 10500 });
    await midnightTab
      .getByText(/Extra manual diagnostics used 40 of 40/)
      .waitFor();
    await improve.waitFor({ state: "hidden", timeout: 10500 });
    const apiStatus = async () => {
      const data = await midnightTab.evaluate(async () =>
        (await fetch("/api/trpc/getAiStatus")).json(),
      );
      return data.result.data.json as {
        budget: { resetAt: string; used: number; diagnostic: number };
      };
    };
    const oldBudget = (await apiStatus()).budget;
    assert.equal(oldBudget.diagnostic, 40);
    assert.equal(oldBudget.used, ordinary);
    await f.sql(
      `update onboarding_clock.settings set delta=delta+((date_trunc('day',clock_timestamp() at time zone 'UTC')+interval '1 day') at time zone 'UTC'-clock_timestamp())-interval '1 second'`,
    );
    // Do not move either ledger row. The running database clock crosses midnight.
    await on(midnightTab);
    await improve.waitFor({ timeout: 10500 });
    const newDay = await f.sql("select " + daySql);
    assert.notEqual(oldDay, newDay);
    const nextBudget = (await apiStatus()).budget;
    assert.equal(
      Date.parse(nextBudget.resetAt) - Date.parse(oldBudget.resetAt),
      86400000,
    );
    assert.equal(nextBudget.diagnostic, 0);
    assert(nextBudget.used < ordinary);
    await improve.click();
    await eventually(
      () =>
        f.sql(
          `select count from rate_limit where key='ai:instance:day:${newDay}'`,
        ),
      (n) => Number(n) > 0,
    );
    await f.sql(
      `update rate_limit set count=${ordinary} where key='ai:instance:day:${newDay}'`,
    );
    await heading(midnightTab, "AI paused").waitFor();
    await button(midnightTab, "Test again").click();
    await eventually(
      () =>
        f.sql(
          `select count from rate_limit where key='ai:instance:day:diagnostic:${newDay}'`,
        ),
      (n) => Number(n) > 0,
    );
    assert.equal(
      await f.sql(
        `select count from rate_limit where key='ai:instance:day:diagnostic:${oldDay}'`,
      ),
      "40",
    );
    assert.equal(
      await f.sql(
        `select count from rate_limit where key='ai:instance:day:${oldDay}'`,
      ),
      String(ordinary),
    );
    await mounted(midnightTab);
    await mounted(drawer);
    await mounted(host);
    return {
      closedCreditMs,
      creditAdmissions: observed.length,
      activationMs: Math.round(activationMs),
      fundedMs: Math.round(fundedMs),
      utcDays: [oldDay, newDay],
    };
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
    const progress = await f
      .sql(
        `select json_build_object('enabled',enabled,'revision',revision,'issued',"checkSequence",'settled',"lastCheck"->>'sequence','issue',"lastCheck"->>'chatIssue','polls',(select count(*) from onboarding_clock.poll)) from ai_settings`,
      )
      .catch(() => "");
    throw new Error(
      "P11 browser failed during " + step + " " + alerts + " " + progress,
      {
        cause: e,
      },
    );
  } finally {
    await browser.close();
  }
}
