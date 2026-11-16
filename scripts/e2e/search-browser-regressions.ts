import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Page } from "playwright";
import { eventually } from "./run";

type Docker = (...args: string[]) => Promise<string>;
export async function coldSearchRecovery(
  page: Page,
  base: string,
  project: string,
  docker: Docker,
  bootReadyAt: number,
) {
  const query = async (statement: string) =>
    (
      await docker(
        "exec",
        project + "-pg",
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        "board_content",
        "-Atqc",
        statement,
      )
    ).trim();
  const request = page.context().request;
  const rpc = async (name: string, input: unknown) => {
    const response = await request.post(base + "/api/trpc/" + name, {
      headers: { origin: base },
      data: { json: input },
    });
    assert.equal(response.status(), 200);
    return (await response.json()).result.data.json;
  };
  const status = async () =>
    (await (await request.get(base + "/api/trpc/getSearchIndex")).json()).result
      .data.json;
  await eventually(
    () => docker("logs", project + "-web"),
    (s) =>
      s.includes('"name":"probe"') && s.includes('"stage":"provider-error"'),
  );
  await delay(Math.max(0, 20_000 - (Date.now() - bootReadyAt)));
  assert.equal((await status()).state, "unverified");
  const post = await rpc("createFeedbackPost", {
    description: "Cold recovery fixture feedback",
  });
  assert.match(post.id, /^[a-f0-9-]{36}$/);
  assert.equal(
    await query(`select "moderationState" from feedback where id='${post.id}'`),
    "unscreened",
  );
  assert.equal(
    await query(
      `select reason from moderation_event where "postId"='${post.id}'`,
    ),
    "provider-error",
  );
  const ticket = await rpc("issueSearchTicket", {
    nonce: randomBytes(32).toString("hex"),
  });
  const exact = await rpc("getFeedbackPosts", {
    limit: 20,
    orderBy: "newest",
    status: null,
    searchValue: "Cold recovery fixture",
    capability: ticket,
  });
  assert.equal(exact.search.mode, "exact");
  assert(exact.feedbackPosts.some((p: { id: string }) => p.id === post.id));
  await page.goto(base + "/admin/system");
  await page.getByText(/Waiting for the embedding provider/).waitFor();
  const restored = Date.now();
  await docker("kill", "--signal=HUP", project + "-provider");
  await eventually(
    () => docker("logs", project + "-provider"),
    (logs) => logs.includes("Content fixture ready"),
    10_000,
  );
  await page.goto(base + "/admin/system");
  await page
    .getByText(/Semantic search is available/)
    .waitFor({ timeout: Math.max(1, 180_000 - (Date.now() - restored)) });
  await eventually(
    () =>
      query(`select embedding is not null from feedback where id='${post.id}'`),
    (v) => v === "t",
    Math.max(1, 180_000 - (Date.now() - restored)),
  );
  const recoveryMs = Date.now() - restored;
  assert(recoveryMs <= 180_000, "Provider recovery exceeded three minutes");
  assert.equal((await status()).state, "verified");
  await query(`delete from feedback where id='${post.id}'`);
  await routeAndEmptyStates(page, base, query, ticket);
  // Hold the shared budget at its limit so both screens exercise exact mode
  // while the recovered provider remains available to the rest of the suite.
  const dayKey = await query(
    "select 'ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')",
  );
  assert.match(dayKey, /^ai:instance:day:\d{4}-\d{2}-\d{2}$/);
  const spent = await query(
    `select count from rate_limit where key='${dayKey}'`,
  );
  assert.match(spent, /^\d+$/);
  await query(`update rate_limit set count=5000 where key='${dayKey}'`);
  try {
    await browserRegressions(page, base, query);
  } finally {
    await query(`update rate_limit set count=${spent} where key='${dayKey}'`);
  }
  return {
    setupAndPostDuringOutage: true,
    fallback: "exact",
    recoveredAndIndexedMs: recoveryMs,
  };
}

async function routeAndEmptyStates(
  page: Page,
  base: string,
  query: (statement: string) => Promise<string>,
  ticket: string,
) {
  const request = page.context().request;
  const board = { orderBy: "newest", status: null, limit: 20, searchValue: "" };
  const activity = {
    orderBy: "newest",
    status: null,
    pageSize: 20,
    categories: null,
    excludeFeedback: false,
    excludeComments: false,
    unseenOnly: false,
    searchValue: "",
  };
  const work = () =>
    query(
      "select (select count(*) from search_session)||','||(select coalesce(sum(calls),0) from llm_usage where feature='embed-query')",
    );
  const before = await work();
  const setup = await query(
    'select extract(epoch from "setupCompletedAt") from settings where id=1',
  );
  assert.match(setup, /^\d+(\.\d+)?$/);
  await query('update settings set "setupCompletedAt"=null where id=1');
  try {
    const blocked = await request.post(base + "/api/trpc/getFeedbackPosts", {
      headers: { origin: base },
      data: {
        json: {
          ...board,
          searchValue: "Fixture before setup",
          capability: ticket,
        },
      },
    });
    assert.equal(blocked.status(), 403);
    assert.equal((await blocked.json()).error.json.message, "SETUP_REQUIRED");
  } finally {
    await query(
      `update settings set "setupCompletedAt"=to_timestamp(${setup}) where id=1`,
    );
  }
  // Ordinary browse and search in one real tRPC GET batch must be handled independently.
  for (const [name, input] of [
    ["getFeedbackPosts", board],
    ["getActivityFeed", activity],
  ] as const) {
    const url = new URL("/api/trpc/" + name + "," + name, base);
    url.searchParams.set("batch", "1");
    url.searchParams.set(
      "input",
      JSON.stringify({
        0: { json: input },
        1: { json: { ...input, searchValue: "Transport fixture" } },
      }),
    );
    const response = await request.get(url.href);
    assert.equal(response.status(), 207);
    const [browse, rejected] = await response.json();
    assert(browse.result.data.json);
    assert.equal(rejected.error.json.data.code, "METHOD_NOT_SUPPORTED");
  }
  assert.equal(await work(), before);
  // Show a genuinely empty semantic result through its pending and ready states.
  await page.goto(base);
  const phrase = "Empty semantic fixture";
  const pattern = "**/api/trpc/getFeedbackPosts**";
  let pending = true;
  await page.route(pattern, async (route) => {
    if (!pending || !route.request().postData()?.includes(phrase))
      return route.continue();
    const response = await route.fetch();
    const payload = await response.json();
    const data = payload[0].result.data.json;
    assert.equal(data.search.mode, "semantic");
    assert.deepEqual(data.feedbackPosts, []);
    data.search.status = "pending";
    pending = false;
    await route.fulfill({ response, json: payload });
  });
  try {
    await page.getByPlaceholder("Search...").first().fill(phrase);
    await page.getByText("Preparing search results…").waitFor();
    assert.equal(
      await page.getByText("No feedback matches your search.").count(),
      0,
    );
    await page.getByText("No feedback matches your search.").waitFor();
    await page.getByText(/Approximate matches/).waitFor();
  } finally {
    await page.unroute(pattern);
  }
}

async function browserRegressions(
  page: Page,
  base: string,
  query: (statement: string) => Promise<string>,
) {
  const marker = "Search review marker",
    missing = "No matching feedback fixture";
  const id = await query(
    `insert into feedback(title,description,"plainText","moderationState") values('${marker}','body','body','screened') returning id`,
  );
  assert.match(id, /^[a-f0-9-]{36}$/);
  await page.goto(base + "/admin/activity");
  const activity = page.getByRole("textbox", { name: "Search activity feed" });
  await activity.fill(marker);
  await page.getByText("Exact text matches.", { exact: true }).waitFor();
  const mark = page.getByRole("button", { name: "Mark as read", exact: true });
  await mark.click();
  await mark.waitFor({ state: "detached" });
  assert.equal(
    await query(`select count(*) from activity_seen where "itemId"='${id}'`),
    "1",
  );

  const sessions = () => query("select count(*) from search_session");
  await page.goto(base);
  const field = page.getByPlaceholder("Search...").first();
  await field.fill(marker);
  await page.getByText("Exact text matches.", { exact: true }).waitFor();
  const count = await sessions();
  const card = page.locator(`[data-post-id="${id}"]`);
  await card.locator(`a[href*="${id}"]`).first().click();
  await page.waitForURL((url) => url.pathname.endsWith(id));
  await page.goBack();
  await card.waitFor();
  await delay(650);
  assert.equal(await field.inputValue(), marker);
  assert.equal(await sessions(), count);

  // Re-fetch the same ordinal list after a successful mutation, keeping its identity.
  const paidCalls = () =>
    query(
      "select coalesce(sum(calls),0) from llm_usage where feature='embed-query'",
    );
  const beforeMutation = await paidCalls();
  await card.getByRole("button", { name: "Open options menu" }).click();
  await page.getByRole("menuitem", { name: "Set status" }).hover();
  await page
    .getByRole("menuitemradio", { name: "Planned", exact: true })
    .click();
  await card.getByText("planned", { exact: true }).waitFor();
  assert.equal(await sessions(), count);
  assert.equal(await paidCalls(), beforeMutation);
  await field.fill(missing);
  await page
    .getByText("No feedback matches your search.", { exact: true })
    .waitFor();
  const prefix = "x".repeat(200);
  await field.fill(prefix + "one");
  await page.waitForResponse(
    (r) =>
      r.url().includes("getFeedbackPosts") &&
      r.request().postData()?.includes(prefix) === true,
  );
  const after = await sessions();
  await field.fill(prefix + "two");
  await delay(800);
  assert.equal(await sessions(), after);
  // Equivalent spelling must keep both the UI threshold and the snapshot stable.
  await field.fill("e\u0301");
  await delay(750);
  assert.equal(await sessions(), after);
  await field.fill("é");
  await delay(750);
  assert.equal(await sessions(), after);
  await field.fill("Cafe\u0301");
  await page
    .getByText("No feedback matches your search.", { exact: true })
    .waitFor();
  assert.equal(Number(await sessions()), Number(after) + 1);
  await field.fill("Café");
  await delay(750);
  assert.equal(Number(await sessions()), Number(after) + 1);
  await page.getByRole("button", { name: "Planned", exact: true }).click();
  await eventually(
    async () => Number(await sessions()),
    (n) => n === Number(after) + 2,
  );
  assert.equal(await field.inputValue(), "Café");

  for (const surface of ["board", "activity"] as const) {
    for (const removeAll of [false, true]) {
      const phrase =
        "Ordinal range " + surface + (removeAll ? " complete" : " partial");
      await query(
        `insert into feedback(title,description,"plainText","moderationState") select '${phrase} '||n,'body','body','screened' from generate_series(1,65)n`,
      );
      const procedure =
        surface === "board" ? "getFeedbackPosts" : "getActivityFeed";
      await page.goto(surface === "board" ? base : base + "/admin/activity");
      const input = surface === "board" ? field : activity;
      let removed = false,
        resumed = 0;
      await page.route("**/api/trpc/" + procedure + "**", async (route) => {
        if (!route.request().postData()?.includes(phrase))
          return route.continue();
        if (removed) {
          resumed++;
          return route.continue();
        }
        const resp = await route.fetch(),
          raw = await resp.json();
        const data = (Array.isArray(raw) ? raw[0] : raw).result.data.json;
        assert(data.nextCursor);
        const first = data.feedbackPosts ?? data.items;
        assert.equal(first.length, 20);
        // Remove two full ordinal ranges while the original snapshot is immutable.
        const capability = data.search.capability as string;
        assert.match(capability, /^[0-9a-f]{64}\.\d{13}\.[0-9a-f]{64}$/);
        await query(`delete from feedback where title like '${phrase} %' and id in
        (select (item->>1)::uuid from search_session cross join lateral jsonb_array_elements(results) with ordinality r(item,n)
         where "capabilityHash"=encode(sha256(convert_to('${capability}','UTF8')),'hex') and n<=${removeAll ? 65 : 40})`);
        removed = true;
        await route.continue();
      });
      await input.fill(phrase);
      await eventually(
        async () => resumed,
        (n) => n >= 2,
      );
      if (removeAll)
        await page
          .getByText(
            surface === "board"
              ? "No feedback matches your search."
              : "No activity matches your search.",
            { exact: true },
          )
          .waitFor();
      else if (surface === "board")
        await page.locator("[data-post-id]").first().waitFor();
      else
        await page
          .getByRole("heading", { name: new RegExp(phrase) })
          .first()
          .waitFor();
      await page.unrouteAll({ behavior: "wait" });
      await query(`delete from feedback where title like '${phrase} %'`);
    }
  }
  // Retry the exact failed continuation and keep the rows already on screen.
  const phrase = "Page throttle fixture";
  await query(
    `insert into feedback(title,description,"plainText","moderationState") select '${phrase} '||n,'body','body','screened' from generate_series(1,35)n`,
  );
  await page.goto(base);
  let continuations = 0;
  const pattern = "**/api/trpc/getFeedbackPosts**";
  await page.route(pattern, async (route) => {
    const body = route.request().postData();
    if (!body?.includes(phrase) || !body.includes('"nextOrdinal":20'))
      return route.continue();
    if (++continuations > 1) return route.continue();
    await route.fulfill({
      status: 429,
      json: [
        {
          error: {
            json: {
              message: "RATE_LIMITED",
              code: -32000,
              data: {
                code: "TOO_MANY_REQUESTS",
                httpStatus: 429,
                retryAfterSeconds: 1,
              },
            },
          },
        },
      ],
    });
  });
  try {
    await field.fill(phrase);
    const cards = page.locator("[data-post-id]").filter({ hasText: phrase });
    await cards.first().waitFor();
    const firstId = await cards.first().getAttribute("data-post-id");
    await cards.last().evaluate((el) => {
      el.scrollIntoView({ block: "start" });
      for (let p = el.parentElement; p; p = p.parentElement)
        if (p.scrollHeight > p.clientHeight) p.scrollTop = p.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    });
    const retry = page.getByRole("button", { name: "Try again" });
    await retry.waitFor();
    assert.equal(await cards.count(), 20);
    assert.equal(await field.inputValue(), phrase);
    await retry.click();
    await eventually(
      () => cards.count(),
      (count) => count === 35,
    );
    assert.equal(continuations, 2);
    assert.equal(await cards.first().getAttribute("data-post-id"), firstId);
  } finally {
    await page.unroute(pattern);
    await query(`delete from feedback where title like '${phrase} %'`);
  }
  // Render the ordinary client error contract, including a timed retry.
  await page.goto(base + "/admin/activity");
  for (const [suffix, code, http] of [
    ["access", "FORBIDDEN", 403],
    ["rate", "TOO_MANY_REQUESTS", 429],
  ] as const) {
    await page.route("**/api/trpc/getActivityFeed**", async (route) => {
      if (
        !route
          .request()
          .postData()
          ?.includes("UI error " + suffix)
      )
        return route.continue();
      const item = {
        error: {
          json: {
            message:
              suffix === "access"
                ? "Sign in again with an administrator"
                : "RATE_LIMITED",
            code: -32000,
            data: { code, httpStatus: http, retryAfterSeconds: 2 },
          },
        },
      };
      await route.fulfill({
        status: http,
        contentType: "application/json",
        json: [item],
      });
    });
    await activity.fill("UI error " + suffix);
    if (suffix === "access") {
      await page
        .getByText("Sign in with an administrator account to search Activity.")
        .waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Start a new search" }).count(),
        0,
      );
    } else {
      const retry = page.getByRole("button", { name: "Try again" });
      await retry.waitFor();
      assert(await retry.isDisabled());
      await eventually(() => retry.isEnabled(), Boolean, 4000);
    }
    await page.unrouteAll({ behavior: "wait" });
  }
  await query(`delete from feedback where id='${id}'`);
}
