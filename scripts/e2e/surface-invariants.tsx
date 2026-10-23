import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { EmbedProvider } from "../../providers/embed";
import { SurfaceProviders } from "../../providers/surface";
import { boardHref } from "../../lib/board-href";
import { parseEmbedSurface, EMBED_HEADER } from "../../lib/embed-surface";
import { proxy } from "../../proxy";

async function main() {
  assert.equal(parseEmbedSurface([]), null);
  assert.equal(parseEmbedSurface(["x", "drawer"]), "drawer");
  assert.equal(parseEmbedSurface(["drawer", "x"]), "drawer");
  assert.equal(parseEmbedSurface(["DRAWER", "drawers"]), null);
  assert.equal(
    boardHref("/post?filter=1#text", "drawer", "dark"),
    "/post?filter=1&embed=drawer&mode=dark#text",
  );
  assert.throws(() => boardHref("//foreign.invalid"));
  for (const query of [
    "",
    "?embed=x",
    "?embed=x&embed=drawer",
    "?embed=drawer&embed=x",
  ]) {
    const response = proxy(
      new NextRequest(`http://fixture.invalid/${query}`, {
        headers: { [EMBED_HEADER]: "spoofed" },
      }),
    );
    assert.equal(
      response.headers.get(`x-middleware-request-${EMBED_HEADER}`),
      query.includes("drawer") ? "drawer" : "first-party",
    );
    if (query.includes("drawer"))
      assert.equal(
        response.headers.get("content-security-policy"),
        "frame-ancestors *",
      );
    const admin = proxy(
      new NextRequest(`http://fixture.invalid/admin${query}`),
    );
    assert.equal(
      admin.headers.get("content-security-policy"),
      null,
      "Proxy must not override private-route denial",
    );
  }
  let mounted = 0;
  function Descendant(): never {
    mounted++;
    throw new Error("Unresolved descendants mounted");
  }
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("SSR started outbound work");
  };
  try {
    const markup = renderToStaticMarkup(
      <SearchParamsContext.Provider value={new URLSearchParams("embed=drawer")}>
        <EmbedProvider>
          <SurfaceProviders>
            <Descendant />
          </SurfaceProviders>
        </EmbedProvider>
      </SearchParamsContext.Provider>,
    );
    assert.match(markup, /data-surface="unresolved"/);
    assert.equal(mounted, 0);
  } finally {
    globalThis.fetch = original;
  }
  async function audit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await audit(file);
      else if (/\.(tsx?|mjs)$/.test(file)) {
        const source = await readFile(file, "utf8");
        if (file.replaceAll("\\", "/") !== "lib/copy-text.ts")
          assert.doesNotMatch(source, /navigator\.clipboard/, file);
      }
    }
  }
  for (const directory of [
    "app",
    "lib",
    "components",
    "hooks",
    "providers",
    "queries",
    "trpc",
    "db",
  ])
    await audit(directory);
  const root = await readFile("app/layout.tsx", "utf8");
  assert.doesNotMatch(root, /AuthProvider|TRPCClientProvider|JotaiProvider/);
  assert.match(root, /getAll\('embed'\)\.includes\('drawer'\)/);
  console.log(
    "surface invariants: unresolved SSR, any-match hints, private framing, links and clipboard scope passed",
  );
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
