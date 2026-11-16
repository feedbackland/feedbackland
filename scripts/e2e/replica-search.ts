import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { chromium, type APIRequestContext } from "playwright";
import { eventually, toolEnvironment } from "./run";
import { fixturePassword } from "./setup-browser";
type Docker = (...args: string[]) => Promise<string>;
type Cursor = { capability: string; nextOrdinal: number };
export async function replicaSearch(
  a: string,
  b: string,
  project: string,
  docker: Docker,
) {
  assert.match(a, /^http:\/\/localhost:\d+$/);
  assert.match(b, /^http:\/\/localhost:\d+$/);
  assert.match(project, /^p07-\d+-[a-f0-9]+-ai$/);
  const pg = project + "-pg",
    provider = project + "-provider";
  const query = async (statement: string) =>
    (
      await docker(
        "exec",
        pg,
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
  const resetBudget = () =>
    query("delete from rate_limit where key like 'ai:instance:day:%'");
  await resetBudget();
  const verified = async (base: string) =>
    (
      await (
        await fetch(base + "/api/settings", {
          signal: AbortSignal.timeout(2000),
        })
      ).json()
    ).capabilities.embeddings;
  await eventually(() => verified(a), Boolean);
  await eventually(() => verified(b), Boolean);
  await query(`insert into feedback(title,description,"plainText",status,"moderationState",embedding)
    select 'P09 replica item '||n,'Body','Body','planned','screened',('['||(1+mod(n,31)*0.02)||repeat(',1',767)||']')::vector from generate_series(1,225)n`);
  await query(
    `insert into feedback(title,description,"plainText",status,"moderationState","embeddingSkipped") values('P09 replica exact','Body','Body','planned','screened',true)`,
  );
  const browser = await chromium.launch({
    env: toolEnvironment() as Record<string, string>,
  });
  try {
    const context = await browser.newContext(),
      page = await context.newPage();
    const rpc = async (
      client: APIRequestContext,
      base: string,
      name: string,
      input: unknown,
    ) =>
      client.post(base + "/api/trpc/" + name, {
        headers: { origin: base },
        data: { json: input },
      });
    const signing = await context.request.post(a + "/api/auth/sign-in/email", {
      headers: { origin: a },
      data: { email: "admin@fixture.invalid", password: fixturePassword },
    });
    assert.equal(signing.status(), 200);
    const ticket = async () => {
      const response = await rpc(context.request, a, "issueSearchTicket", {
        nonce: randomBytes(32).toString("hex"),
      });
      assert.equal(response.status(), 200);
      return (await response.json()).result.data.json as string;
    };
    const snapshot = async (ticket: string) => {
      const hash = createHash("sha256").update(ticket).digest("hex");
      return (
        JSON.parse(
          await query(
            `select results::text from search_session where "capabilityHash"='${hash}'`,
          ),
        ) as [string, string, number | null][]
      ).map(([kind, id]) => [kind, id]);
    };
    const capability = await ticket();
    const input = {
      status: "planned",
      orderBy: "newest",
      searchValue: "P09 replica",
      limit: 19,
      capability,
    };
    const posts = async (base: string, cursor?: Cursor) => {
      const response = await rpc(context.request, base, "getFeedbackPosts", {
        ...input,
        cursor,
      });
      assert.equal(response.status(), 200);
      return (await response.json()).result.data.json as {
        feedbackPosts: { id: string; title: string }[];
        nextCursor?: Cursor;
        search: { mode: string };
      };
    };
    const calls = async () =>
      Number(
        await query(
          "select coalesce(sum(calls),0) from llm_usage where feature='embed-query'",
        ),
      );
    const before = await calls();
    let result = await posts(a);
    assert.equal(result.search.mode, "semantic");
    assert(result.nextCursor);
    const expected = await snapshot(capability);
    const activityCap = await ticket();
    const activity = async (base: string, cursor?: Cursor) => {
      const response = await rpc(context.request, base, "getActivityFeed", {
        pageSize: 19,
        orderBy: "newest",
        status: null,
        categories: null,
        excludeFeedback: false,
        excludeComments: false,
        unseenOnly: false,
        searchValue: "P09 replica",
        capability: activityCap,
        cursor,
      });
      assert.equal(response.status(), 200);
      return (await response.json()).result.data.json as {
        items: { type: string; id: string }[];
        nextCursor?: Cursor;
        search: { mode: string };
      };
    };
    let activityPage = await activity(a);
    assert.equal(activityPage.search.mode, "semantic");
    const expectedActivity = await snapshot(activityCap);
    const activityIds = activityPage.items.map(({ type, id }) => [type, id]);
    const firstCursor = result.nextCursor;
    const ids = result.feedbackPosts.map((row) => row.id);
    await docker("kill", "--signal=HUP", provider);
    await eventually(
      () => docker("logs", provider),
      (logs) => logs.includes("Embedding fixture offline true"),
    );
    try {
      await query(
        `update rate_limit set count=5000 where key like 'ai:instance:day:%'`,
      );
      for (let n = 0; result.nextCursor; n++) {
        result = await posts(n % 2 ? a : b, result.nextCursor);
        assert.equal(result.search.mode, "semantic");
        ids.push(...result.feedbackPosts.map((row) => row.id));
      }
      assert(ids.length >= 226);
      assert.equal(new Set(ids).size, ids.length);
      assert.deepEqual(
        ids.map((id) => ["post", id]),
        expected,
      );
      for (let n = 0; activityPage.nextCursor; n++) {
        activityPage = await activity(n % 2 ? a : b, activityPage.nextCursor);
        activityIds.push(
          ...activityPage.items.map(({ type, id }) => [type, id]),
        );
      }
      assert.deepEqual(activityIds, expectedActivity);
      assert.equal(await calls(), before + 2);
      assert.equal(result.feedbackPosts.at(-1)?.title, "P09 replica exact");
      const deletion = (await posts(b, firstCursor)).feedbackPosts[0];
      assert.match(deletion.title, /^P09 replica item/);
      assert.match(deletion.id, /^[0-9a-f-]{36}$/);
      await query(
        `delete from feedback where id='${deletion.id}'::uuid and title like 'P09 replica item%'`,
      );
      const after = await posts(a, firstCursor);
      assert.deepEqual(
        after.feedbackPosts.map((p) => p.id),
        expected
          .slice(firstCursor.nextOrdinal, firstCursor.nextOrdinal + 19)
          .map((row) => row[1])
          .filter((id) => id !== deletion.id),
      );
      assert.equal(after.feedbackPosts.length, 18);
      assert.equal(after.nextCursor?.nextOrdinal, 38);
      const fallback = await rpc(context.request, b, "getFeedbackPosts", {
        ...input,
        capability: await ticket(),
      });
      assert.equal(
        (await fallback.json()).result.data.json.search.mode,
        "exact",
      );
    } finally {
      await docker("kill", "--signal=HUP", provider);
      await resetBudget();
    }
    // Search in the real UI keeps both the phrase and displayed results on a stale next page.
    await page.goto(a);
    const field = page.getByPlaceholder("Search...").first();
    const searching = page.waitForResponse(
      (r) =>
        r.url().includes("getFeedbackPosts") && r.request().method() === "POST",
    );
    await field.fill("P09 replica");
    const seen = await searching;
    assert(!seen.url().includes("input="));
    await page
      .getByText("Approximate matches", { exact: false })
      .first()
      .waitFor();
    const cards = page.locator("[data-post-id]");
    await cards.first().waitFor();
    const displayed = await cards.first().getAttribute("data-post-id");
    const system = await context.newPage();
    await system.goto(a + "/admin/system");
    await system.getByLabel("Rebuild at dimensions").fill("1536");
    await system
      .getByRole("button", { name: "Rebuild search index", exact: true })
      .click();
    await system
      .getByRole("button", { name: "Confirm rebuild", exact: true })
      .click();
    await system
      .getByText("Index rebuild committed.", { exact: false })
      .waitFor();
    await cards.last().evaluate((el) => {
      el.scrollIntoView({ block: "start" });
      for (let p = el.parentElement; p; p = p.parentElement)
        if (p.scrollHeight > p.clientHeight) p.scrollTop = p.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    });
    const restart = page.getByRole("button", { name: "Start a new search" });
    await restart.waitFor();
    assert.equal(await cards.first().getAttribute("data-post-id"), displayed);
    assert.equal(await field.inputValue(), "P09 replica");
    const sessionsBeforeRestart = Number(
      await query("select count(*) from search_session"),
    );
    await restart.click();
    await restart.waitFor({ state: "hidden" });
    await eventually(
      async () => Number(await query("select count(*) from search_session")),
      (n) => n === sessionsBeforeRestart + 1,
    );
    assert.equal(await field.inputValue(), "P09 replica");
    const old = await rpc(context.request, b, "getFeedbackPosts", {
      ...input,
      cursor: firstCursor,
    });
    assert.equal(old.status(), 409);
    assert.equal(
      (await old.json()).error.json.message,
      "SEARCH_RESTART_REQUIRED",
    );
    await eventually(
      () => docker("logs", provider),
      (logs) => logs.includes("Embedding fixture width 1536"),
      30000,
    );
    await eventually(
      async () => {
        const response = await context.request.get(
          b + "/api/trpc/getSearchIndex",
        );
        const status = (await response.json()).result?.data?.json;
        return status?.dimensions === 1536 && status.state === "verified";
      },
      Boolean,
      30000,
    );
    const fresh = await rpc(context.request, b, "getFeedbackPosts", {
      ...input,
      capability: await ticket(),
    });
    assert.equal(fresh.status(), 200);
    assert.equal((await fresh.json()).result.data.json.search.mode, "semantic");
    return {
      replicas: 2,
      ids: ids.length,
      embeddingCallsForTwoSearches: 2,
      additionalCallsForTraversal: 0,
      widthBefore: 768,
      widthAfter: 1536,
      deletionAndRestart: "passed",
    };
  } finally {
    await browser.close();
  }
}
