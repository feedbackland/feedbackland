import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { command } from "./run";

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "feedbackland-inventory-"));
  const script = resolve("scripts/caller-inventory.ts");
  const loader = pathToFileURL(
    resolve("node_modules/tsx/dist/loader.mjs"),
  ).href;
  const output = join(directory, "inventory.md");
  const run = (...flags: string[]) =>
    command(process.execPath, ["--import", loader, script, output, ...flags], {
      cwd: directory,
    });
  try {
    for (const name of [
      "app",
      "components",
      "hooks",
      "lib",
      "providers",
      "queries",
      "trpc",
      "db",
    ])
      await mkdir(join(directory, name));
    await writeFile(
      join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "esnext",
          moduleResolution: "bundler",
          paths: { "@/*": ["./*"] },
          allowImportingTsExtensions: true,
          noEmit: true,
        },
      }),
    );
    const sources = {
      "trpc/index.ts": "export const router = {};",
      "queries/example.ts": "export const query = {};",
      "queries/unused.ts": "export const unused = {};",
      "app/route.ts": 'import { router } from "@/trpc"; void router;',
      "hooks/relative.ts":
        'import { query } from "../queries/example"; void query;',
      "lib/explicit.ts":
        'import { query } from "../queries/example.ts"; void query;',
      "providers/barrel.ts": 'export { query } from "@/queries/example";',
    };
    for (const [file, source] of Object.entries(sources))
      await writeFile(join(directory, file), source);
    await run();
    const generated = await readFile(output, "utf8");
    assert.match(generated, /\| `trpc\/index.ts` \| `app\/route.ts` \|/);
    assert.match(
      generated,
      /\| `queries\/example.ts` \| `hooks\/relative.ts`, `lib\/explicit.ts`, `providers\/barrel.ts` \|/,
    );
    assert.match(generated, /\| `queries\/unused.ts` \| No active importer/);
    await run("--verify");
    await writeFile(output, generated + "stale\n");
    await assert.rejects(run("--verify"), /Caller inventory is stale/);
    assert.equal(await readFile(output, "utf8"), generated + "stale\n");
    console.log(
      "caller inventory: aliases, barrels, parent paths, extensions and drift passed",
    );
  } finally {
    assert.equal(
      resolve(directory).startsWith(resolve(tmpdir()) + "\\") ||
        resolve(directory).startsWith(resolve(tmpdir()) + "/"),
      true,
    );
    await rm(directory, { recursive: true, force: true });
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
