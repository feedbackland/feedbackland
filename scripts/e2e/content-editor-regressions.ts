import assert from "node:assert/strict";
import type { Page } from "playwright";
import { samples } from "./image-fixtures";

async function heldResponse(page: Page, procedure: string) {
  const received = Promise.withResolvers<ResponseData>(),
    resume = Promise.withResolvers<void>();
  const match = new RegExp("/api/trpc/" + procedure + "(?:\\?|$)");
  await page.route(match, async (route) => {
    try {
      const real = await route.fetch();
      received.resolve((await real.json())[0]);
      await resume.promise;
      await route.fulfill({ response: real });
    } catch (error) {
      received.reject(error);
    }
  });
  return {
    received: received.promise,
    release: resume.resolve,
    remove: () => page.unroute(match),
  };
}
type ResponseData = {
  result?: { data: { json: { id: string; revision: string } } };
  error?: { json: { message: string } };
};
export async function editorRegressions(page: Page, base: string) {
  await page.goto(base);
  const editor = page.getByRole("textbox", { name: "Your feedback" }),
    submit = page.getByRole("button", { name: "Submit feedback" });
  await editor.fill("Original draft.");
  const create = await heldResponse(page, "createFeedbackPost");
  let postId: string;
  try {
    await submit.click();
    postId = (await create.received).result!.data.json.id;
    await editor.fill("Newer detail entered during submission.");
    await page
      .locator("form input[type=file]")
      .setInputFiles({
        name: "later.gif",
        mimeType: "image/gif",
        buffer: samples.gif,
      });
    await editor.locator('img[src^="/api/images/"]').waitFor();
  } finally {
    create.release();
  }
  await page
    .getByRole("status")
    .filter({ hasText: "Feedback submitted" })
    .waitFor();
  assert.match(await editor.innerText(), /Newer detail/);
  assert.equal(await editor.locator("img").count(), 1);
  await create.remove();

  for (const path of ["/", "/?embed=drawer"]) {
    await page.goto(base + path);
    let enabled = true;
    await page.route("**/api/settings", async (route) => {
      const real = await route.fetch(),
        data = await real.json();
      data.capabilities.chat = enabled;
      await route.fulfill({ response: real, json: data });
    });
    const improve = page.getByRole("button", {
      name: "Improve my draft",
      exact: true,
    });
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Draft improvements are currently unavailable" });
    await editor.fill("Fixture rewrite unavailable");
    await improve.click();
    await alert.waitFor();
    await editor.fill("Another draft");
    await alert.waitFor({ state: "hidden" });
    await editor.fill("Fixture rewrite unavailable");
    await improve.click();
    await alert.waitFor();
    const refresh = () =>
      page.evaluate(() => window.dispatchEvent(new Event("focus")));
    enabled = false;
    await refresh();
    await improve.waitFor({ state: "hidden" });
    await alert.waitFor({ state: "hidden" });
    enabled = true;
    await refresh();
    await improve.waitFor();
    assert.equal(await alert.count(), 0);
    await page.unroute("**/api/settings");
  }

  const first = await page.context().newPage(),
    other = await page.context().newPage();
  try {
    const open = async (p: Page, kind: "post" | "comment") => {
      await p.goto(base + "/" + postId);
      const menu = p
        .getByRole("button", { name: "Open options menu" })
        .nth(kind === "post" ? 0 : 1);
      await menu.click();
      await p.getByRole("menuitem", { name: "Edit " + kind }).click();
      await p.getByRole("button", { name: "Save", exact: true }).waitFor();
    };
    // An ordinary comment gives the second editing case its own revision.
    await other.goto(base + "/" + postId);
    const composer = other.locator(".tiptap[contenteditable=true]").last();
    await composer.fill("Original comment.");
    const posting = await heldResponse(other, "createComment");
    try {
      await other.getByRole("button", { name: "Submit comment" }).click();
      await posting.received;
      assert(await composer.evaluate((el) => !!el.closest("[inert]")));
    } finally {
      posting.release();
    }
    await other
      .getByText("Original comment.", { exact: true })
      .first()
      .waitFor();
    await posting.remove();

    await first.clock.install();
    for (const kind of ["post", "comment"] as const) {
      await open(first, kind);
      await open(other, kind);
      const editable = (p: Page) =>
        p
          .locator("form")
          .filter({
            has: p.locator("button[type=submit]").filter({ hasText: /^Save$/ }),
          })
          .locator(".tiptap");
      await editable(first).fill("Unsaved local " + kind);
      await editable(other).fill("New saved " + kind);
      const procedure =
        kind === "post" ? "updateFeedbackPost" : "updateComment";
      const saving = await heldResponse(other, procedure);
      try {
        await other.getByRole("button", { name: "Save", exact: true }).click();
        assert((await saving.received).result);
        assert(await editable(other).evaluate((el) => !!el.closest("[inert]")));
      } finally {
        saving.release();
      }
      await other
        .getByRole("button", { name: "Save", exact: true })
        .waitFor({ state: "hidden" });
      await saving.remove();
      await first.clock.fastForward(31000);
      const refresh = first.waitForResponse(
        (r) =>
          r
            .url()
            .includes(kind === "post" ? "getFeedbackPost" : "getComments") &&
          r.status() === 200,
      );
      await first.evaluate(() =>
        window.dispatchEvent(new Event("visibilitychange")),
      );
      await refresh;
      const conflict = first.waitForResponse(
        (r) => r.url().includes(procedure) && r.request().method() === "POST",
      );
      await first.getByRole("button", { name: "Save", exact: true }).click();
      assert.equal(
        (await (await conflict).json())[0].error.json.message,
        "CONTENT_CHANGED",
      );
      assert.equal(await editable(first).innerText(), "Unsaved local " + kind);
      await other.reload();
      await other
        .getByText("New saved " + kind, { exact: true })
        .first()
        .waitFor();
    }
    await other.setViewportSize({ width: 480, height: 800 });
    await other.goto(base + "/" + postId);
    let historyRequests = 0;
    await other.route("**/api/trpc/createComment*", async (route) => {
      historyRequests++;
      await route.fulfill({ status: 429, json: { error: "AI_BUSY" } });
    });
    await other
      .getByRole("button", { name: "Open options menu" })
      .first()
      .click();
    await other.getByRole("menuitem", { name: "Set status" }).hover();
    await other
      .getByRole("menuitemradio", { name: "Planned", exact: true })
      .click();
    await other
      .locator(".text-planned")
      .filter({ hasText: "planned" })
      .first()
      .waitFor();
    await other
      .getByText("Updated status to", { exact: false })
      .first()
      .waitFor();
    assert.equal(historyRequests, 0);
  } finally {
    await first.close();
    await other.close();
  }
}
