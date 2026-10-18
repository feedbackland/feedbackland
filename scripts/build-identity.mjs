import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

// These are the image's application inputs, also allowed by .dockerignore.
const inputs = [
  "app",
  "components",
  "db",
  "feedbackland-react",
  "hooks",
  "lib",
  "providers",
  "public",
  "queries",
  "trpc",
  "scripts/build-identity.mjs",
  "package.json",
  "package-lock.json",
  ".npmrc",
  "next.config.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "components.json",
  "proxy.ts",
  "instrumentation.ts",
  "firebaseConfig.ts",
  "LICENSE",
  "Dockerfile",
  ".dockerignore",
];
const files = [];
async function collect(path) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOTDIR" && error.code !== "ENOENT") throw error;
    if (error.code === "ENOTDIR") files.push(path);
    return;
  }
  for (const entry of entries) {
    if (
      ["node_modules", "dist", ".next"].includes(entry.name) ||
      entry.name === ".npmrc" ||
      entry.name.startsWith(".env") ||
      entry.name.endsWith(".tsbuildinfo")
    )
      continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) await collect(child);
    else if (
      entry.isFile() &&
      child.replaceAll("\\", "/") !== "lib/build-identity.json"
    )
      files.push(child);
  }
}
for (const path of inputs) await collect(path);
const tree = createHash("sha256");
for (const file of files.sort()) {
  tree.update(relative(".", file).replaceAll("\\", "/") + "\0");
  tree.update(await readFile(file));
  tree.update("\0");
}
const sourceTreeHash = tree.digest("hex");
const sourceCommit = process.env.SOURCE_COMMIT || null;
if (sourceCommit && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sourceCommit))
  throw new Error("SOURCE_COMMIT must be a Git object id");
const architecture = process.arch;
const artifactId = createHash("sha256")
  .update(`${sourceCommit ?? "tree"}:${sourceTreeHash}:${architecture}`)
  .digest("hex");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  "lib/build-identity.json",
  JSON.stringify(
    {
      sourceCommit,
      sourceTreeHash,
      architecture,
      artifactId,
      version: `${pkg.version}+${artifactId.slice(0, 12)}`,
    },
    null,
    2,
  ) + "\n",
);
