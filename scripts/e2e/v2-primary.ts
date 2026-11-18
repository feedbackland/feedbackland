import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import type { Page, Response } from "playwright";
import { samples } from "./image-fixtures";
import { eventually } from "./run";
import { openWidget, signIn } from "./v3-auth";
import { createAuthWidgetHost } from "./widget-host";

type Cursor = { capability: string; nextOrdinal: number };
type Row = {
  id: string;
  revision: string;
  title: string;
  moderationState: string;
  upvotes: number;
};
const header = (origin: string) => ({
  origin,
  "content-type": "application/json",
});

export async function primaryJourney(
  previous: Page,
  base: string,
  mode: "exact" | "semantic",
  sql: (statement: string) => Promise<string>,
  lan = false,
) {
  const context = await previous.context().browser()!.newContext();
  try {
    const page = await context.newPage();
    await page.goto(base);
    await signIn(page, "admin@fixture.invalid");
    assert.equal(await page.evaluate(() => window.isSecureContext), !lan);
    return await signedInJourney(page, base, mode, sql, lan);
  } finally {
    await context.close();
  }
}

async function signedInJourney(
  page: Page,
  base: string,
  mode: "exact" | "semantic",
  sql: (statement: string) => Promise<string>,
  lan: boolean,
) {
  async function rpc<T>(name: string, json?: unknown) {
    const response = await page.request.post(base + "/api/trpc/" + name, {
      headers: header(base),
      data: json === undefined ? {} : { json },
    });
    assert.equal(response.status(), 200, name);
    return (await response.json()).result.data.json as T;
  }
  const token = "reviewjourney" + randomBytes(6).toString("hex");
  const draft = page.getByRole("textbox", { name: "Your feedback" });
  await draft.fill(token + " attachment");
  if (mode === "exact")
    assert.equal(
      await page.getByRole("button", { name: "Improve my draft" }).count(),
      0,
    );
  await page.locator("form input[type=file]").setInputFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer: samples.png,
  });
  const attachment = draft.locator('img[src^="/api/images/"]');
  await attachment.waitFor();
  const url = await attachment.getAttribute("src");
  assert(url);
  await page
    .getByRole("button", { name: "Submit feedback", exact: true })
    .click();
  const postId = await eventually(
    () =>
      sql(
        'select id from feedback where "plainText" = \'' +
          token +
          " attachment'",
      ),
    (id) => /^[0-9a-f-]{36}$/.test(id),
  );
  assert.equal(
    await sql(
      'select "moderationState" from feedback where id=\'' + postId + "'",
    ),
    mode === "exact" ? "disabled" : "screened",
  );
  await page.goto(base + "/" + postId);
  const comment = page.locator('[contenteditable="true"]').last();
  await comment.fill(token + " first comment");
  await page
    .getByRole("button", { name: "Submit comment", exact: true })
    .click();
  await page.getByText(token + " first comment", { exact: true }).waitFor();
  const vote = page.getByRole("button", {
    name: "Upvote feedback",
    exact: true,
  });
  await vote.click();
  const voted = page
    .getByRole("button", { name: /Upvote feedback|Remove upvote/ })
    .first();
  await eventually(
    () => voted.innerText({ timeout: 1500 }),
    (value) => value.trim() === "1",
  );

  const menus = page.getByRole("button", {
    name: "Open options menu",
    exact: true,
  });
  await menus.nth(1).click();
  await page
    .getByRole("menuitem", { name: "Edit comment", exact: true })
    .click();
  await page
    .locator('[contenteditable="true"]')
    .last()
    .fill(token + " revised reply");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText(token + " revised reply", { exact: true }).waitFor();
  await menus.first().click();
  await page.getByRole("menuitem", { name: "Edit post", exact: true }).click();
  const title = page.getByPlaceholder("Title", { exact: true });
  await title.fill(token + " revised post");
  const edition = page
    .locator("form")
    .filter({ has: title })
    .locator('[contenteditable="true"]');
  await edition.press("Home");
  await page.keyboard.insertText("Updated ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("heading", { name: token + " revised post", exact: true })
    .waitFor();
  assert.equal(await page.locator(".tiptap-output img").count(), 1);
  assert.equal((await page.request.get(base + url)).status(), 200);
  assert.equal(
    await sql("select revision::text from feedback where id='" + postId + "'"),
    "2",
  );
  assert.equal(
    await sql(
      'select revision::text from comment where "postId"=\'' + postId + "'",
    ),
    "2",
  );
  if (mode === "exact") {
    await sql(`insert into feedback(title,description,"plainText","moderationState")
      select '${token} result '||i,'${token} search','${token} search','disabled'
      from generate_series(1,44) i`);
  }
  const ticket = () =>
    rpc<string>("issueSearchTicket", {
      nonce: randomBytes(32).toString("hex"),
    });
  const defaults = { searchValue: token, status: null, orderBy: "newest" };
  const postQuery = { ...defaults, limit: 19, capability: await ticket() };
  const activityQuery = {
    ...defaults,
    pageSize: 19,
    categories: null,
    excludeFeedback: false,
    excludeComments: true,
    unseenOnly: false,
    capability: await ticket(),
  };
  type Results = { search: { mode: string }; nextCursor?: Cursor | null };
  const board = async (cursor?: Cursor) => {
    const state = await rpc<Results & { feedbackPosts: Row[] }>(
      "getFeedbackPosts",
      { ...postQuery, cursor },
    );
    return { ...state, ids: state.feedbackPosts.map((row) => row.id) };
  };
  const activity = async (cursor?: Cursor) => {
    const state = await rpc<Results & { items: { id: string }[] }>(
      "getActivityFeed",
      { ...activityQuery, cursor },
    );
    return { ...state, ids: state.items.map((row) => row.id) };
  };
  for (const query of [board, activity]) {
    let current = await query();
    assert.equal(current.search.mode, mode);
    const ids = [...current.ids];
    if (mode === "exact") {
      for (let i = 0; current.nextCursor && i < 3; i++) {
        current = await query(current.nextCursor);
        assert.equal(current.search.mode, "exact");
        ids.push(...current.ids);
      }
      assert(!current.nextCursor, "exact paging must terminate");
      assert.equal(ids.length, 45);
      assert.equal(new Set(ids).size, 45);
    }
    assert(ids.includes(postId));
  }

  if (mode === "exact") {
    const images = await rpc<{ feedbackPosts: Row[] }>("getFeedbackPosts", {
      ...postQuery,
      searchValue: "image",
      capability: await ticket(),
    });
    assert(!images.feedbackPosts.some(({ id }) => id === postId));
  }

  for (const surface of ["board", "activity"]) {
    await page.goto(surface === "board" ? base : base + "/admin/activity");
    const field =
      surface === "board"
        ? page.getByPlaceholder("Search...").first()
        : page.getByRole("textbox", { name: "Search activity feed" });
    const responses: Promise<unknown>[] = [];
    const track = (response: Response) => {
      if (
        !response
          .url()
          .includes(
            surface === "board" ? "getFeedbackPosts" : "getActivityFeed",
          )
      )
        return;
      responses.push(
        response
          .json()
          .then((value) => {
            const entries = Array.isArray(value) ? value : [value];
            return entries.map((entry) => {
              const result = entry.result?.data?.json;
              return {
                code: response.status(),
                items: (result?.feedbackPosts ?? result?.items)?.length,
                mode: result?.search?.mode,
                next: result?.nextCursor?.nextOrdinal,
                error: entry.error?.json?.data?.code,
              };
            });
          })
          .catch(() => ({ code: response.status() })),
      );
    };
    page.on("response", track);
    await field.fill(token);
    if (mode === "exact") {
      const results =
        surface === "board"
          ? page.locator("[data-post-id]").filter({ hasText: token })
          : page.getByRole("heading", {
              name: new RegExp("^" + token + " (revised post|result )"),
            });
      await results.first().waitFor();
      // The first two pages may fill the viewport before the next-page
      // sentinel is visible. Bring the sentinel itself into view.
      const sentinel = page.locator("div.h-1.w-full").last();
      let count = 0;
      await eventually(
        async () => {
          count = await results.count();
          if (count < 45)
            await sentinel.evaluateAll((elements) =>
              elements.at(-1)?.scrollIntoView({ block: "end" }),
            );
          return count;
        },
        (next) => next === 45,
        15_000,
      ).catch(async (cause) => {
        throw new Error(
          surface +
            " exact search stopped at " +
            count +
            " results " +
            JSON.stringify(await Promise.all(responses)),
          { cause },
        );
      });
      const rendered = await results.evaluateAll((elements) =>
        elements.map(
          (element) =>
            element.getAttribute("data-post-id") ?? element.textContent,
        ),
      );
      assert.equal(new Set(rendered).size, 45, surface);
    }
    await page
      .getByRole("heading", { name: token + " revised post", exact: true })
      .first()
      .waitFor();
    page.off("response", track);
  }
  if (lan) {
    await page.goto(base + "/admin/widget");
    // The syntax-highlighted snippet is produced after the widget hydrates.
    await page.locator("pre.shiki").last().waitFor();
    await page.evaluate(() => {
      document.execCommand = (command) => {
        document.documentElement.dataset.legacyClipboard = command;
        return false;
      };
    });
    await page
      .getByRole("button", { name: "Copy", exact: true })
      .last()
      .click();
    const clipboard = page.getByRole("dialog", { name: "Copy text manually" });
    await clipboard.waitFor();
    assert.equal(
      await page.locator("html").getAttribute("data-legacy-clipboard"),
      "copy",
    );
    assert(
      (
        await clipboard
          .getByRole("textbox", { name: "Text to copy" })
          .inputValue()
      ).includes(base),
    );
    await clipboard.getByRole("button", { name: "Close", exact: true }).click();
  }
  const host = await createAuthWidgetHost(undefined, base);
  try {
    host.listen(0, "127.0.0.1");
    await once(host, "listening");
    const address = host.address();
    assert(address && typeof address !== "string");
    const top =
      "http://127.0.0.1:" +
      address.port +
      "/?board=" +
      encodeURIComponent(base);
    await page.bringToFront();
    await page.goto(top);
    const frame = await openWidget(page, base);
    await frame
      .getByRole("textbox", { name: "Your feedback" })
      .fill(token + " from embedded drawer");
    if (mode === "exact")
      assert.equal(
        await frame.getByRole("button", { name: "Improve my draft" }).count(),
        0,
      );
    await frame.getByRole("button", { name: "Submit feedback" }).click();
    await frame.getByText("Feedback submitted", { exact: true }).waitFor();
    await page.goto(top + "&widget=popover");
    await page
      .getByRole("button", { name: "Open feedback", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Feedback", exact: true })
      .fill(token + " from popover");
    await page
      .getByRole("button", { name: "Submit feedback", exact: true })
      .click();
    await page
      .getByText("Feedback received. Thank you!", { exact: true })
      .waitFor();
    const expected = mode === "exact" ? "disabled" : "screened";
    await eventually(
      () =>
        sql(
          `select count(*) from feedback where "plainText" like '${token} from %' and "authorId" is null and "moderationState" = '${expected}'`,
        ),
      (count) => count === "2",
      5000,
    );
  } finally {
    await new Promise<void>((done, reject) =>
      host.close((error) => (error ? reject(error) : done())),
    );
  }
  return {
    mode,
    renderedSignIn: true,
    lanClipboard: lan,
    image: true,
    vote: true,
    bothEdits: true,
    widget: ["drawer", "popover"],
    resultsOnBothSurfaces: mode === "exact" ? 45 : "contains edited post",
  };
}

export async function keylessAiEndpoints(page: Page, base: string) {
  const cases = [
    [
      "/api/chat",
      {
        messages: [
          { role: "user", parts: [{ type: "text", text: "What happened?" }] },
        ],
      },
    ],
    ["/api/trpc/startInsightsRun", {}],
    [
      "/api/trpc/rewriteFeedback",
      { json: { description: "An unfinished draft" } },
    ],
  ] as const;
  for (const [path, data] of cases) {
    const response = await page.request.post(base + path, {
      headers: header(base),
      data,
    });
    const value = await response.json();
    assert.equal(
      value.error?.json?.message ?? value.error,
      "AI_NOT_CONFIGURED",
      path,
    );
  }
  return cases.length;
}
