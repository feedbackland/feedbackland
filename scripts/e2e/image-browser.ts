import assert from "node:assert/strict";
import type { Page, Locator } from "playwright";
import { once } from "node:events";
import { eventually } from "./run";
import { createAuthWidgetHost } from "./widget-host";
import { frameOn } from "./v3-auth";
import { samples } from "./image-fixtures";
import { sendImage } from "./image-http-contracts";
async function sendEditorFile(editor: Locator, method: "paste" | "drop") {
  await editor.evaluate(
    (element, { method, encoded }) => {
      const data = new DataTransfer();
      data.items.add(
        new File(
          [Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))],
          "animation.gif",
          { type: "image/gif" },
        ),
      );
      const rect = element.getBoundingClientRect();
      const event =
        method === "paste"
          ? new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData: data,
            })
          : new DragEvent("drop", {
              bubbles: true,
              cancelable: true,
              dataTransfer: data,
              clientX: rect.x + 10,
              clientY: rect.y + 5,
            });
      element.dispatchEvent(event);
    },
    { method, encoded: samples.gif.toString("base64") },
  );
}
async function holdUpload(
  page: Page,
  editor: Locator,
  submit: Locator,
  insert: () => Promise<void>,
) {
  const pattern = "**/api/images";
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const ready = editor.locator('img[src^="/api/images/"]');
  const before = await ready.count();
  await page.route(pattern, async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await insert();
    await editor.getByText("Uploading image…").waitFor();
    assert(
      await submit.isDisabled(),
      "Save was enabled while an attachment was pending",
    );
    release();
    await eventually(
      () => ready.count(),
      (count) => count === before + 1,
    );
    assert(await submit.isEnabled());
  } finally {
    release();
    await page.unroute(pattern);
  }
}
export async function imageBrowser(
  page: Page,
  base: string,
  artifact: string,
  lan = false,
) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const title = lan ? "LAN attachment walkthrough" : "Attachment walkthrough";
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page.getByLabel("Choose a logo").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: samples.png,
  });
  await page.getByRole("button", { name: "Crop and upload" }).click();
  await page
    .getByRole("dialog", { name: "Upload logo" })
    .waitFor({ state: "hidden" });
  const logo = page.getByRole("img", { name: "Current board logo" });
  await logo.waitFor();
  const logoUrl = new URL((await logo.getAttribute("src"))!, base).pathname;
  await page.goto(base);
  const editor = page.getByRole("textbox", { name: "Your feedback" });
  await editor.fill(title);
  const large = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 3200;
    c.height = 80;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "blue";
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL("image/png").split(",")[1];
  });
  const submit = page.getByRole("button", {
    name: "Submit feedback",
    exact: true,
  });
  await holdUpload(page, editor, submit, () =>
    page.locator("form input[type=file]").setInputFiles({
      name: "wide.png",
      mimeType: "image/png",
      buffer: Buffer.from(large, "base64"),
    }),
  );
  const first = editor.locator('img[src^="/api/images/"]').first();
  await first.waitFor();
  assert.equal(await first.getAttribute("width"), "2000");
  assert.equal(await first.getAttribute("height"), "50");
  const imageUrl = (await first.getAttribute("src"))!;
  if (lan) {
    assert.equal(await page.evaluate(() => window.isSecureContext), false);
    await page.evaluate(() => {
      document.execCommand = () => false;
    });
    await first.hover();
    await editor.getByRole("button", { name: "Copy image link" }).click();
    assert.equal(
      await page.getByLabel("Text to copy").inputValue(),
      base + imageUrl,
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("button", { name: "Submit feedback" }).click();
  await page.getByRole("heading", { name: title, exact: true }).click();
  await page.getByRole("heading", { level: 1, name: title }).waitFor();
  const displayed = page.locator(".tiptap-output img").first();
  await displayed.waitFor();
  assert.equal(
    new URL((await displayed.getAttribute("src"))!, base).pathname,
    imageUrl,
  );
  const vote = page.getByRole("button", {
    name: "Upvote feedback",
    exact: true,
  });
  await vote.click();
  await eventually(
    () => vote.innerText(),
    (v) => v.trim() === "1",
  );
  const comment = page.locator("[contenteditable=true]").last();
  await comment.fill("Attached comment");
  await comment.evaluate((element) => {
    const data = new DataTransfer();
    data.setData(
      "text/html",
      '<p>pasted<img src="//external.invalid/pixel.png"></p>',
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.equal(await comment.locator("img").count(), 0);
  await comment.fill("Attached comment");
  await holdUpload(
    page,
    comment,
    page.getByRole("button", { name: "Submit comment", exact: true }),
    () => sendEditorFile(comment, "paste"),
  );
  await page
    .getByRole("button", { name: "Submit comment", exact: true })
    .click();
  await page.getByText("Attached comment", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Open options menu" }).nth(1).click();
  await page.getByRole("menuitem", { name: "Edit comment" }).click();
  const edit = page.locator("[contenteditable=true]").last();
  await edit.press("ControlOrMeta+End");
  await edit.press("End");
  await page.keyboard.type(" revised");
  await holdUpload(
    page,
    edit,
    page.getByRole("button", { name: "Save", exact: true }),
    () => sendEditorFile(edit, "paste"),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByText(/revised/)
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Open options menu" }).first().click();
  await page.getByRole("menuitem", { name: "Edit post" }).click();
  const titleInput = page.getByPlaceholder("Title", { exact: true });
  await titleInput.fill(title + " edited");
  const postEdit = page
    .locator("form")
    .filter({ has: titleInput })
    .locator("[contenteditable=true]");
  await holdUpload(
    page,
    postEdit,
    page.getByRole("button", { name: "Save", exact: true }),
    () => sendEditorFile(postEdit, "drop"),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("heading", { level: 1, name: title + " edited" })
    .waitFor();
  await page.screenshot({ path: artifact });
  const host = await createAuthWidgetHost(undefined, base);
  try {
    host.listen(0, "127.0.0.1");
    await once(host, "listening");
    const address = host.address();
    assert(address && typeof address !== "string");
    const widget = await frameOn(
      page,
      "http://127.0.0.1:" + address.port,
      base,
    );
    const box = widget.getByRole("textbox", { name: "Your feedback" });
    await box.fill("Drawer attachment");
    await sendEditorFile(box, "drop");
    await box.locator('img[src^="/api/images/"]').waitFor();
    await widget.getByRole("button", { name: "Submit feedback" }).click();
    await widget.getByText("Feedback submitted", { exact: true }).waitFor();
  } finally {
    await new Promise<void>((yes, no) =>
      host.close((e) => (e ? no(e) : yes())),
    );
  }
  // Attach one previewed image while the admin is deciding. Only the other is reclaimed.
  const kept = await (await sendImage(base)).json(),
    removed = await (await sendImage(base)).json();
  await page.goto(base + "/admin/system");
  await page
    .getByRole("button", { name: "Reclaim unattached uploads", exact: true })
    .click();
  await page.getByText(/including attachments in unsent drafts/).waitFor();
  assert.equal(
    (
      await fetch(base + "/api/feedback/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description:
            '<p>Saved during preview<img src="' + kept.url + '"></p>',
        }),
      })
    ).status,
    201,
  );
  await page
    .getByRole("button", { name: "Confirm reclaim", exact: true })
    .click();
  await page.getByText("Unattached uploads reclaimed.").waitFor();
  assert.equal((await fetch(base + kept.url)).status, 200);
  assert.equal((await fetch(base + removed.url)).status, 404);
  assert.deepEqual(errors, []);
  return {
    logoUrl,
    imageUrl,
    toolbar: true,
    paste: true,
    drop: true,
    wideImage: [2000, 50],
    freshReclaim: true,
  };
}
