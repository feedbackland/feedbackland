import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  copyFile,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { command } from "./run";

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "p01-identity-"));
  try {
    await mkdir(join(directory, "scripts"));
    await mkdir(join(directory, "lib"));
    await copyFile(
      "scripts/build-identity.mjs",
      join(directory, "scripts/build-identity.mjs"),
    );
    await writeFile(join(directory, "package.json"), '{"version":"0.0.0"}\n');
    const generate = async (fresh = false) => {
      await command(
        process.execPath,
        ["scripts/build-identity.mjs", ...(fresh ? ["--fresh"] : [])],
        { cwd: directory, env: { SOURCE_COMMIT: "a".repeat(40) } },
      );
      return JSON.parse(
        await readFile(join(directory, "lib/build-identity.json"), "utf8"),
      );
    };
    const first = await generate(true);
    const reused = await generate();
    const rebuilt = await generate(true);
    assert.equal(
      reused.artifactId,
      first.artifactId,
      "typechecking rotated build identity",
    );
    assert.equal(rebuilt.sourceTreeHash, first.sourceTreeHash);
    assert.notEqual(rebuilt.buildNonce, first.buildNonce);
    assert.notEqual(
      rebuilt.artifactId,
      first.artifactId,
      "independent rebuild reused identity",
    );
    assert.notEqual(rebuilt.deploymentId, first.deploymentId);
    assert.match(rebuilt.deploymentId, /^[a-f0-9]{32}$/);
    await writeFile(
      join(directory, "lib/example.ts"),
      "export const fixture = 1;\n",
    );
    assert.notEqual((await generate()).sourceTreeHash, first.sourceTreeHash);
    console.log(
      "build identity: passed (fresh builds differ, typecheck reuse, source changes, platform limit)",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
