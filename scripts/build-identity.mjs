import { createHash, randomBytes } from "node:crypto";
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
const flags = process.argv.slice(2);
if (flags.some((flag) => flag !== "--fresh"))
  throw new Error("Unknown build identity option");
const artifactFor = (nonce) =>
  createHash("sha256")
    .update(
      `${sourceCommit ?? "local"}:${sourceTreeHash}:${architecture}:${nonce}`,
    )
    .digest("hex");
let buildNonce = randomBytes(16).toString("hex");
// Reuse for typechecking/dev, but every actual build requests a fresh nonce:
// identical source may still produce different Next action keys/manifests.
if (!flags.includes("--fresh")) {
  try {
    const previous = JSON.parse(
      await readFile("lib/build-identity.json", "utf8"),
    );
    if (
      previous &&
      previous.sourceCommit === sourceCommit &&
      previous.sourceTreeHash === sourceTreeHash &&
      previous.architecture === architecture &&
      /^[a-f0-9]{32}$/.test(previous.buildNonce) &&
      previous.artifactId === artifactFor(previous.buildNonce)
    )
      buildNonce = previous.buildNonce;
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
}
const artifactId = artifactFor(buildNonce);
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  "lib/build-identity.json",
  JSON.stringify(
    {
      sourceCommit,
      sourceTreeHash,
      architecture,
      buildNonce,
      artifactId,
      // The deployment platform accepts at most 32 URL-safe characters (128 bits of this hash).
      deploymentId: artifactId.slice(0, 32),
      version: `${pkg.version}+${artifactId.slice(0, 12)}`,
    },
    null,
    2,
  ) + "\n",
);
