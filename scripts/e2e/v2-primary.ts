import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import type { Page } from "playwright";
import { samples } from "./image-fixtures";
import { eventually } from "./run";
import { openWidget } from "./v3-auth";
import { createAuthWidgetHost } from "./widget-host";

type Cursor = { capability: string; offset: number };
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
  page: Page,
  base: string,
  mode: "exact" | "semantic",
  sql: (statement: string) => Promise<string>,
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
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(samples.png)], { type: "image/png" }),
    "sample.png",
  );
  const image = await fetch(base + "/api/images", {
    method: "POST",
    body: form,
  });
  assert.equal(image.status, 201);
  const { url } = await image.json();
  const post = await rpc<Row>("createFeedbackPost", {
    description: token + ' attached <img src="' + url + '">',
  });
  assert.match(post.id, /^[0-9a-f-]{36}$/);
  assert.equal(
    post.moderationState,
    mode === "exact" ? "disabled" : "screened",
  );
  const comment = await rpc<Row>("createComment", {
    postId: post.id,
    parentCommentId: null,
    content: token + " reply before edit",
  });
  const revised = await rpc<Row>("updateFeedbackPost", {
    postId: post.id,
    expectedRevision: post.revision,
    title: token + " revised post",
    description: token + ' updated <img src="' + url + '">',
  });
  const reply = await rpc<Row>("updateComment", {
    commentId: comment.id,
    expectedRevision: comment.revision,
    content: token + " revised reply",
  });
  assert.notEqual(revised.revision, post.revision);
  assert.notEqual(reply.revision, comment.revision);
  await rpc("upvoteFeedbackPost", { postId: post.id });
  await page.goto(base + "/" + post.id);
  await page.getByRole("heading", { name: token + " revised post" }).waitFor();
  await page.getByText(token + " revised reply", { exact: true }).waitFor();
  const votes = page.getByRole("button", {
    name: /Upvote feedback|Remove upvote/,
  });
  assert.match((await votes.first().textContent())?.trim() ?? "", /^1$/);
  assert.equal(await page.locator(".tiptap-output img").count(), 1);
  assert.equal((await page.request.get(base + url)).status(), 200);
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
    assert(ids.includes(post.id));
  }

  if (mode === "exact") {
    const images = await rpc<{ feedbackPosts: Row[] }>("getFeedbackPosts", {
      ...postQuery,
      searchValue: "image",
      capability: await ticket(),
    });
    assert(!images.feedbackPosts.some(({ id }) => id === post.id));
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
