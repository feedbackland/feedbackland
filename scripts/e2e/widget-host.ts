import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { build } from "vite";

/** Bundle the real workspace widget once; serve only those fixture assets. */
export async function createAuthWidgetHost() {
  const directory = await mkdtemp(join(tmpdir(), "p04-widget-"));
  const assets = new Map<string, Uint8Array>();
  try {
    await writeFile(
      join(directory, "index.html"),
      '<!doctype html><html><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>',
    );
    await writeFile(
      join(directory, "entry.js"),
      await readFile("ci/fixtures/auth-widget-host.js", "utf8"),
    );
    const result = await build({
      configFile: false,
      envDir: false,
      root: directory,
      logLevel: "error",
      plugins: [
        {
          name: "fixture-browser-entries",
          enforce: "pre",
          resolveId(source) {
            const entries: Record<string, string> = {
              "feedbackland-react":
                "feedbackland-react/dist/feedbackland-react.js",
              react: "node_modules/react/index.js",
              "react/jsx-runtime": "node_modules/react/jsx-runtime.js",
              "react/jsx-dev-runtime": "node_modules/react/jsx-dev-runtime.js",
              "react-dom": "node_modules/react-dom/index.js",
              "react-dom/client": "node_modules/react-dom/client.js",
            };
            return entries[source] ? resolve(entries[source]) : undefined;
          },
        },
      ],
      build: { write: false, modulePreload: false },
    });
    for (const output of Array.isArray(result) ? result : [result]) {
      assert("output" in output, "Widget fixture must produce a bundle");
      for (const entry of output.output)
        assets.set(
          "/" + entry.fileName,
          Buffer.from(entry.type === "chunk" ? entry.code : entry.source),
        );
    }
    assert(assets.has("/index.html"));
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
  return createServer((request, response) => {
    const url = new URL(request.url!, "http://fixture.invalid");
    if (
      url.pathname === "/" &&
      !/^http:\/\/localhost:[0-9]+$/.test(url.searchParams.get("board") ?? "")
    ) {
      response.writeHead(400).end();
      return;
    }
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const bytes = assets.get(path);
    if (!bytes) {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, {
        "content-type": path.endsWith(".html")
          ? "text/html"
          : path.endsWith(".js")
            ? "application/javascript"
            : path.endsWith(".css")
              ? "text/css"
              : "application/octet-stream",
        "cache-control": "no-store",
      })
      .end(bytes);
  });
}
