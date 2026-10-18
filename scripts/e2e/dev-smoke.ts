import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { command, eventually, toolEnvironment } from "./run";
async function main() {
  assert(
    (await readdir(".")).every(
      (file) => !file.startsWith(".env") || file === ".env.example",
    ),
    "Use an isolated checkout without operator dotenv files",
  );
  const project = `p02-dev-${randomUUID().slice(0, 8)}`,
    directory = await mkdtemp(join(tmpdir(), "p02-dev-"));
  await writeFile(join(directory, ".env"), "");
  const compose = (...args: string[]) =>
    command(
      "docker",
      [
        "compose",
        "-p",
        project,
        "--env-file",
        join(directory, ".env"),
        "-f",
        resolve("compose.dev.yml"),
        ...args,
      ],
      { env: { FEEDBACKLAND_DEV_DB_PORT: "0" } },
    );
  let child: ReturnType<typeof spawn> | undefined,
    output = "";
  try {
    await compose("up", "-d", "--wait");
    const dbPort = (await compose("port", "db", "5432")).split(":").at(-1)!;
    assert.equal(
      await compose(
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "postgres",
        "-d",
        "feedbackland",
        "-Atc",
        "select 1",
      ),
      "1",
    );
    const port = await new Promise<number>((resolvePort, reject) => {
      const server = createServer();
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        assert(address && typeof address === "object");
        server.close(() => resolvePort(address.port));
      });
    });
    child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        env: toolEnvironment({
          NODE_ENV: "development",
          DATABASE_URL: `postgres://postgres:feedbackland@127.0.0.1:${dbPort}/feedbackland`,
        }),
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const exited = new Promise<never>((_, reject) => {
      child!.on("error", reject);
      child!.on("exit", (code) =>
        reject(new Error(`Development server exited ${code}`)),
      );
    });
    // Always observe the exit rejection, including after deliberate cleanup.
    void exited.catch(() => {});
    const capture = (bytes: Buffer) => {
      output = (output + bytes.toString()).slice(-128_000);
    };
    child.stdout!.on("data", capture);
    child.stderr!.on("data", capture);
    await Promise.race([
      exited,
      eventually(
        async () =>
          (
            await fetch(`http://127.0.0.1:${port}/api/health`, {
              signal: AbortSignal.timeout(5000),
            })
          ).status,
        (status) => status === 200,
        90_000,
      ),
    ]);
    const root = await fetch(`http://127.0.0.1:${port}`);
    assert.equal(root.status, 200);
    assert((await root.text()).includes("Feedback"));
    const settings = await (
      await fetch(`http://127.0.0.1:${port}/api/settings`)
    ).json();
    assert.equal(settings.capabilities.chat, false);
    assert(output.includes("boot.ready"));
    console.log(
      "Development boot, migration, singleton settings and root board passed",
    );
  } finally {
    if (child?.pid) {
      if (process.platform === "win32")
        await command("taskkill", [
          "/pid",
          String(child.pid),
          "/t",
          "/f",
        ]).catch(() => {});
      else {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {}
      }
    }
    await compose("down", "--volumes", "--remove-orphans");
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
