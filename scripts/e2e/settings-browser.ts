import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { createServer } from "vite";
import { chromium, type Page } from "playwright";
import { toolEnvironment } from "./run";

type Snapshot = {
  server: {
    revision: string;
    platformTitle: string;
    platformDescription: string;
  };
  cached: {
    revision: string;
    platformTitle: string;
    platformDescription: string;
  };
  attempts: Array<{ expectedRevision: string }>;
};
declare global {
  interface Window {
    settingsFixture: {
      refreshes: number;
      snapshot(): Snapshot;
      failNextRead(): void;
      externalUpdate(patch: Record<string, string>): Promise<void>;
    };
  }
}
// Flush passive effects after React Query's scheduled notifications, so a reset
// occurring after the save is visible to the assertion (no fixed sleep).
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
  );

async function main() {
  const parent = resolve("artifacts/self-hosting");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, "settings-browser-"));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    await writeFile(
      join(root, "index.html"),
      '<div id="root"></div><script type="module" src="/entry.jsx"></script>',
    );
    await writeFile(
      join(root, "entry.jsx"),
      await readFile("ci/fixtures/settings-browser.jsx", "utf8"),
    );
    server = await createServer({
      configFile: false,
      root,
      logLevel: "error",
      plugins: [
        {
          name: "fixture-admin-identity",
          enforce: "pre",
          transform(code, id) {
            if (
              id.replaceAll("\\", "/").endsWith("/hooks/use-admin-settings.ts")
            ) {
              assert(code.includes('from "./use-auth"'));
              return code.replace(
                'from "./use-auth"',
                'from "fixture-admin-identity"',
              );
            }
          },
          resolveId(source) {
            if (source === "fixture-admin-identity")
              return "\0fixture-admin-identity";
          },
          load(id) {
            if (id === "\0fixture-admin-identity")
              return "export const useAuth = () => ({isAdmin: true});";
          },
        },
      ],
      resolve: {
        alias: [
          {
            find: "next/navigation",
            replacement: resolve("ci/fixtures/settings-browser-navigation.js"),
          },
          { find: "@", replacement: resolve(".") },
          { find: "react", replacement: resolve("node_modules/react") },
          { find: "react-dom", replacement: resolve("node_modules/react-dom") },
        ],
        dedupe: ["react", "react-dom"],
      },
      server: { host: "127.0.0.1", port: 0, fs: { allow: [resolve(".")] } },
    });
    await server.listen();
    const address = server.httpServer!.address();
    assert(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({
      env: Object.fromEntries(
        Object.entries(toolEnvironment()).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
    });
    const errors: string[] = [];
    const newPage = async () => {
      const page = await browser!.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("response", (response) => {
        if (response.status() >= 400)
          errors.push(`${response.status()} ${response.url()}`);
      });
      await page.route("**/*", (route) => {
        assert.equal(
          new URL(route.request().url()).origin,
          origin,
          "Unexpected outbound browser request",
        );
        return route.continue();
      });
      await page.goto(origin);
      try {
        await page
          .getByText("Original title", { exact: true })
          .waitFor({ timeout: 15_000 });
      } catch (error) {
        throw new Error(
          `Settings fixture did not render: ${errors.join("; ")}; body: ${await page.locator("body").innerText()}`,
          { cause: error },
        );
      }
      return page;
    };
    for (const [saved, dirty] of [
      ["title", "description"],
      ["description", "title"],
    ]) {
      const page = await newPage();
      const savedSection = page.getByTestId(saved),
        dirtySection = page.getByTestId(dirty);
      await savedSection
        .getByRole("button", { name: "Edit", exact: true })
        .click();
      await dirtySection
        .getByRole("button", { name: "Edit", exact: true })
        .click();
      await savedSection.getByRole("textbox").fill("Saved value");
      await dirtySection.getByRole("textbox").fill("Unsaved draft");
      await savedSection
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await savedSection
        .getByRole("button", { name: "Edit", exact: true })
        .waitFor();
      await settle(page);
      assert.equal(
        await dirtySection.getByRole("textbox").inputValue(),
        "Unsaved draft",
      );
      await dirtySection
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await dirtySection
        .getByRole("button", { name: "Edit", exact: true })
        .waitFor();
      const result = await page.evaluate(() =>
        window.settingsFixture.snapshot(),
      );
      assert.equal(result.server.revision, "3");
      assert.deepEqual(
        result.attempts.map((save) => save.expectedRevision),
        ["1", "2"],
      );
      await page.close();
    }
    for (const [field, property] of [
      ["title", "platformTitle"],
      ["description", "platformDescription"],
    ]) {
      const page = await newPage(),
        section = page.getByTestId(field);
      await section.getByRole("button", { name: "Edit", exact: true }).click();
      await section.getByRole("textbox").fill("My draft");
      await page.evaluate(
        ({ property }) =>
          window.settingsFixture.externalUpdate({
            [property]: "Other admin's value",
          }),
        { property },
      );
      await settle(page);
      assert.equal(await section.getByRole("textbox").inputValue(), "My draft");
      await section.getByRole("button", { name: "Save", exact: true }).click();
      await section
        .getByText(
          "This setting changed elsewhere. Cancel and reopen to load the current value.",
        )
        .waitFor();
      assert.equal(await section.getByRole("textbox").inputValue(), "My draft");
      await section
        .getByRole("button", { name: "Cancel", exact: true })
        .first()
        .click();
      await section.getByText("Other admin's value", { exact: true }).waitFor();
      await settle(page);
      assert.equal(
        (await page.evaluate(() => window.settingsFixture.snapshot())).attempts
          .length,
        1,
        "Cancel must not submit the form",
      );
      await section.getByRole("button", { name: "Edit", exact: true }).click();
      assert.equal(
        await section.getByRole("textbox").inputValue(),
        "Other admin's value",
      );
      await section.getByRole("textbox").fill("Resolved");
      await section.getByRole("button", { name: "Save", exact: true }).click();
      await section
        .getByRole("button", { name: "Edit", exact: true })
        .waitFor();
      assert.equal(
        (await page.evaluate(() => window.settingsFixture.snapshot())).server
          .revision,
        "3",
      );
      await page.close();
    }
    const page = await newPage(),
      section = page.getByTestId("title");
    await section.getByRole("button", { name: "Edit", exact: true }).click();
    await section.getByRole("textbox").fill("  Canonical title  ");
    await page.evaluate(() => window.settingsFixture.failNextRead());
    await section.getByRole("button", { name: "Save", exact: true }).click();
    await section.getByRole("button", { name: "Edit", exact: true }).waitFor();
    await section.getByText("Canonical title", { exact: true }).waitFor();
    const result = await page.evaluate(() => window.settingsFixture.snapshot());
    assert.equal(result.cached.revision, "2");
    await section.getByRole("button", { name: "Edit", exact: true }).click();
    await section.getByRole("textbox").fill("Next save");
    await section.getByRole("button", { name: "Save", exact: true }).click();
    await section.getByRole("button", { name: "Edit", exact: true }).waitFor();
    assert.deepEqual(
      (
        await page.evaluate(() => window.settingsFixture.snapshot())
      ).attempts.map((save) => save.expectedRevision),
      ["1", "2"],
    );
    assert.deepEqual(errors, []);
    console.log(
      "settings browser: both dirty drafts, unrelated-field rebasing, same-field conflicts, cancel and failed refetch recovery passed",
    );
  } finally {
    await browser?.close();
    await server?.close();
    assert.equal(dirname(root), parent);
    await rm(root, { recursive: true, force: true });
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
