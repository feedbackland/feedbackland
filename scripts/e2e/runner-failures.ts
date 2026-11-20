import assert from "node:assert/strict";
import { command } from "./run";

async function main() {
  assert.equal(
    await command(process.execPath, ["-e", "console.log('fixture success')"]),
    "fixture success",
  );
  await assert.rejects(
    command(process.execPath, [
      "-e",
      "console.error('fixture failure');process.exit(9)",
    ]),
    /failed \(9\):\s*fixture failure/,
  );
  // A graceful zero exit in response to SIGTERM must not erase the deadline.
  await assert.rejects(
    command(
      process.execPath,
      [
        "-e",
        "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000)",
      ],
      { timeout: 500 },
    ),
    /timed out after 500ms/,
  );
  await assert.rejects(
    command(
      process.execPath,
      [
        "-e",
        "process.on('SIGTERM',()=>process.exit(0));process.stdout.write('x'.repeat(8192));setInterval(()=>{},1000)",
      ],
      { maxOutputBytes: 4096 },
    ),
    /exceeded output limit of 4096 bytes/,
  );
  process.env.DATABASE_URL = "fixture-must-not-be-forwarded";
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/fixture-browsers";
  assert.equal(
    await command(process.execPath, [
      "-e",
      "console.log(JSON.stringify([Object.hasOwn(process.env,'DATABASE_URL'),process.env.PLAYWRIGHT_BROWSERS_PATH]))",
    ]),
    '[false,"/fixture-browsers"]',
  );
  console.log(
    "runner failures: passed (nonzero exit, deadline, output cap, browser path, credential isolation)",
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
