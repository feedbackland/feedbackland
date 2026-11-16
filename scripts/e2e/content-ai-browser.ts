import assert from "node:assert/strict";
import { chromium } from "playwright";
import { editorRegressions } from "./content-editor-regressions";
import { samples } from "./image-fixtures";
import { submitSetup } from "./setup-browser";
import { eventually, toolEnvironment } from "./run";

export async function contentBrowser(base: string, setupCode: string) {
  const browser = await chromium.launch({
    env: toolEnvironment() as Record<string, string>,
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await submitSetup(page, base, setupCode);
    const submit = (description: string) =>
      fetch(base + "/api/feedback/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description }),
      });
    const safe = await submit("A normal idea from the public form.");
    assert.equal(safe.status, 201);
    assert.match((await safe.json()).id, /^[a-f\d-]{36}$/);
    assert.equal((await submit("Offline fixture. More detail.")).status, 201);
    const refusal = await submit("Refusal fixture");
    assert.equal(refusal.status, 400);
    assert.deepEqual(await refusal.json(), { error: "inappropriate-content" });

    await page.goto(base + "/admin/activity");
    await page
      .getByRole("heading", { name: "Published fixture idea" })
      .waitFor();
    await page.getByRole("button", { name: "Show unscreened items" }).click();
    await page
      .getByText("Unscreened · provider rate", { exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Published fixture idea" })
      .waitFor({ state: "detached" });
    await page.goto(base + "/admin/system");
    const counts = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Moderation coverage" }),
      })
      .locator("dd");
    assert.deepEqual(
      await eventually(
        () => counts.allTextContents(),
        (v) => v.length === 2,
      ),
      ["1", "1"],
    );

    const editor = page.getByRole("textbox", { name: "Your feedback" });
    const improve = page.getByRole("button", {
      name: "Improve my draft",
      exact: true,
    });
    const images = editor.locator('img[src^="/api/images/"]');
    const ids = () =>
      images.evaluateAll((nodes) =>
        nodes.map((img) => img.getAttribute("src")),
      );
    await page.goto(base);
    await editor.fill("Please improve this draft");
    const picker = page.locator("form input[type=file]");
    await picker.setInputFiles([
      { name: "first.gif", mimeType: "image/gif", buffer: samples.gif },
      { name: "second.gif", mimeType: "image/gif", buffer: samples.gif },
    ]);
    await eventually(
      () => images.count(),
      (n) => n === 2,
    );
    const originals = await ids();
    assert.equal(new Set(originals).size, 2);
    await improve.click();
    await editor
      .getByText("Clearer <b>fixture</b> & detail.", { exact: true })
      .waitFor();
    assert.equal(await editor.locator("b").count(), 0);
    assert.deepEqual(await ids(), originals);

    await page.goto(base + "/?embed=drawer");
    await editor.fill("Original drawer draft");
    let received = false;
    const resume = Promise.withResolvers<void>();
    const pattern = /\/api\/trpc\/rewriteFeedback(?:\?|$)/;
    await page.route(pattern, async (route) => {
      const real = await route.fetch();
      received = true;
      await resume.promise;
      await route.fulfill({ response: real });
    });
    try {
      await improve.click();
      await eventually(
        async () => received,
        (x) => x,
        10000,
      );
      await editor.fill("Drawer edit made while waiting.");
    } finally {
      resume.resolve();
    }
    await improve.waitFor();
    assert.equal(await editor.innerText(), "Drawer edit made while waiting.");
    await editorRegressions(page, base);
    return "Editor revision, pending submissions and keyless transitions, public submit, refusal, outage, Activity and System, board attachments and concurrent drawer edit passed";
  } finally {
    await browser.close();
  }
}
