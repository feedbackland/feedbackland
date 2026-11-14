import assert from "node:assert/strict";
import type { Page } from "playwright";
import { samples } from "./image-fixtures";
import { eventually } from "./run";

export async function attachmentInteractions(page: Page, base: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const box = page.getByRole("textbox", { name: "Your feedback" });
  const picker = page.locator("form input[type=file]");
  const submit = page.getByRole("button", {
    name: "Submit feedback",
    exact: true,
  });
  const attached = box.locator('img[src^="/api/images/"]');
  const pending = box.getByText("Uploading image…");
  const gif = {
    name: "fixture.gif",
    mimeType: "image/gif",
    buffer: samples.gif,
  };
  const pattern = "**/api/images";
  const requests: number[] = [];
  page.on("response", (r) => {
    if (r.request().method() === "POST" && r.url() === base + "/api/images")
      requests.push(r.status());
  });
  const reset = async () => {
    await page.goto(base);
    await box.fill("Draft");
  };
  const hold = async (match = pattern) => {
    let release!: () => void,
      started = false;
    const wait = new Promise<void>((r) => {
      release = r;
    });
    await page.route(match, async (route) => {
      started = true;
      await wait;
      await route.continue().catch(() => {});
    });
    return {
      sent: () =>
        eventually(
          async () => started,
          (s) => s,
          15000,
        ),
      release: async () => {
        release();
        await page.unroute(match);
      },
    };
  };

  await reset();
  await box.fill("   ");
  assert(await submit.isDisabled());
  await box.fill("a".repeat(10000));
  assert(await submit.isEnabled());
  await box.fill("a".repeat(10001));
  assert(await submit.isDisabled());
  await page.getByRole("alert").filter({ hasText: "10,000" }).waitFor();
  await box.fill("");
  let held = await hold();
  await picker.setInputFiles(gif);
  await held.sent();
  assert.equal(
    await picker.evaluate((el: HTMLInputElement) => el.files?.length),
    0,
  );
  assert(await submit.isDisabled());
  await held.release();
  await attached.waitFor();
  assert(await submit.isEnabled());
  const path = await attached.getAttribute("src");
  await box.press("ControlOrMeta+z");
  await eventually(
    () => attached.count(),
    (n) => n === 0,
  );
  assert.equal(await pending.count(), 0);
  await box.press("ControlOrMeta+Shift+z");
  await attached.waitFor();
  assert.equal(await attached.getAttribute("src"), path);
  assert.equal(requests.length, 1);

  await reset();
  held = await hold();
  await picker.setInputFiles(gif);
  await held.sent();
  await box.getByRole("button", { name: "Remove image" }).click();
  await held.release();
  await box.press("ControlOrMeta+z");
  assert.equal(await pending.count(), 0);
  assert(await submit.isEnabled());

  await reset();
  const prior = requests.length;
  await picker.setInputFiles(
    Array.from({ length: 6 }, (_, i) => {
      const buffer = Buffer.from(gif.buffer);
      // Each file has a valid, distinct GIF comment. Check actual bytes after
      // all uploads finish so order is independent of network completion.
      return {
        ...gif,
        name: "batch-" + i + ".gif",
        buffer: Buffer.concat([
          buffer.subarray(0, -1),
          Buffer.from([0x21, 0xfe, 1, i, 0, 0x3b]),
        ]),
      };
    }),
  );
  await eventually(
    () => attached.count(),
    (n) => n === 6,
  );
  assert.deepEqual(requests.slice(prior), Array<number>(6).fill(201));
  const sources = await attached.evaluateAll((images) =>
    images.map((image) => image.getAttribute("src")!),
  );
  const markers = await Promise.all(
    sources.map(async (src) => {
      const bytes = await (await page.request.get(base + src)).body();
      return bytes.at(-3);
    }),
  );
  assert.deepEqual(markers, [0, 1, 2, 3, 4, 5]);
  assert(await submit.isEnabled());

  await reset();
  await page.route(
    pattern,
    (route) => route.fulfill({ status: 507, body: "{}" }),
    { times: 1 },
  );
  await picker.setInputFiles(gif);
  const retry = box.getByRole("button", { name: "Retry upload" });
  await retry.waitFor();
  assert(await submit.isDisabled());
  const beforeRetry = requests.length;
  await retry.click();
  await attached.waitFor();
  assert.deepEqual(requests.slice(beforeRetry), [201]);

  for (const [supported, rich] of [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ]) {
    await reset();
    await box.evaluate(
      (el, { encoded, supported, rich }) => {
        const data = new DataTransfer();
        data.setData("text/plain", "Caption");
        if (rich)
          data.setData(
            "text/html",
            "<p><strong>Caption</strong><img src='//external.invalid/image'></p>",
          );
        data.items.add(
          new File(
            [Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))],
            supported ? "mix.gif" : "notes.txt",
            { type: supported ? "image/gif" : "text/plain" },
          ),
        );
        el.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: data,
          }),
        );
      },
      { encoded: samples.gif.toString("base64"), supported, rich },
    );
    await eventually(
      () => box.innerText(),
      (text) => text.includes("Caption"),
    );
    if (rich)
      assert.equal(await box.locator("strong").textContent(), "Caption");
    if (supported)
      await attached.waitFor({ timeout: 8000 }).catch(async () => {
        throw new Error(
          "Mixed paste did not finish: " +
            JSON.stringify({
              errors,
              statuses: requests,
              text: await box.innerText(),
            }),
        );
      });
    assert.equal(await box.locator('img[src*="external.invalid"]').count(), 0);
    assert.equal(await attached.count(), supported ? 1 : 0);
  }

  await reset();
  const routeSettings = "**/api/settings";
  let limit = 1,
    seen = 0;
  await page.route(routeSettings, async (route) => {
    const res = await route.fetch(),
      settings = await res.json();
    settings.capabilities.maxImageBytes = limit;
    await route.fulfill({ response: res, json: settings });
    seen++;
  });
  const refresh = async () => {
    const previous = seen;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await eventually(
      async () => seen,
      (n) => n > previous,
    );
  };
  await refresh();
  const beforeLimit = requests.length;
  await picker.setInputFiles(gif);
  await retry.waitFor();
  assert.equal(requests.length, beforeLimit);
  limit = 4000000;
  await refresh();
  await retry.click();
  await attached.waitFor();
  assert((await box.innerText()).includes("Draft"));
  await page.unroute(routeSettings);

  // Inspect the clipboard representation without changing the system clipboard.
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      async value(items: ClipboardItem[]) {
        const png = await items[0].getType("image/png");
        document.documentElement.dataset.copyBytes = String(png.size);
      },
    });
  });
  await attached.hover();
  await box.getByRole("button", { name: "Copy image to clipboard" }).click();
  await eventually(
    () => page.locator("html").getAttribute("data-copy-bytes"),
    (n) => Number(n) > 0,
  );

  await page.goto(base + "/admin/activity");
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  const logoInput = page.getByLabel("Choose a logo"),
    dialog = page.getByRole("dialog", { name: "Upload logo" });
  const currentLogo = page.getByRole("img", { name: "Current board logo" });
  const previousLogo = await currentLogo.getAttribute("src");
  for (const dismiss of ["Cancel", "Escape", "Close"]) {
    await logoInput.setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: samples.png,
    });
    held = await hold();
    await dialog.getByRole("button", { name: "Crop and upload" }).click();
    await held.sent();
    if (dismiss === "Escape") await page.keyboard.press("Escape");
    else
      await dialog.getByRole("button", { name: dismiss, exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await held.release();
  }
  await logoInput.setInputFiles({
    name: "unreadable.png",
    mimeType: "image/png",
    buffer: Buffer.from("incomplete image"),
  });
  await dialog
    .getByRole("alert")
    .filter({ hasText: "could not decode" })
    .waitFor();
  assert(
    await dialog.getByRole("button", { name: "Crop and upload" }).isDisabled(),
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  assert.equal(await currentLogo.getAttribute("src"), previousLogo);
  const committing = await hold("**/api/trpc/updateSettings*");
  try {
    await logoInput.setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: samples.png,
    });
    await dialog.getByRole("button", { name: "Crop and upload" }).click();
    await committing.sent();
    assert(await dialog.getByRole("button", { name: "Cancel" }).isDisabled());
    assert(
      await dialog
        .getByRole("button", { name: "Close", exact: true })
        .isDisabled(),
    );
    await page.keyboard.press("Escape");
    assert(await dialog.isVisible());
  } finally {
    await committing.release();
  }
  await dialog.waitFor({ state: "hidden" });
  await eventually(
    () => currentLogo.getAttribute("src"),
    (s) => !!s && s !== previousLogo,
  );
  assert.deepEqual(errors, []);
}
