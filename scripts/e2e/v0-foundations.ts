import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command, eventually } from "./run";

type Check = (name: string, action: () => Promise<unknown>) => Promise<void>;
const docker = (...args: string[]) => command("docker", args);
const json = async (...args: string[]) => JSON.parse(await docker(...args));
const inspect = async (name: string) => (await json("inspect", name))[0];
async function health(url: string) {
  const start = Date.now();
  const response = await fetch(`${url}/api/health`, {
    signal: AbortSignal.timeout(5_000),
  });
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ["status", "version"]);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.status, response.ok ? "ok" : "down");
  return { status: response.status, body, elapsedMs: Date.now() - start };
}

export async function foundations(image: string, runId: string, check: Check) {
  const project = runId.toLowerCase();
  assert.match(project, /^p01-[0-9]+-[a-f0-9]+$/);
  const directory = await mkdtemp(join(tmpdir(), `${project}-`));
  const direct = `${project}-direct`;
  const bad = `${project}-bad-host`;
  const network = `${project}-net`;
  let projectCreated = false;
  let networkCreated = false;
  let primaryError: unknown;
  const containers: string[] = [];
  const composeEnv = { FEEDBACKLAND_IMAGE: image, FEEDBACKLAND_PORT: "0" };
  const compose = (...args: string[]) =>
    command(
      "docker",
      [
        "compose",
        "--project-name",
        project,
        "--env-file",
        join(directory, ".env"),
        "-f",
        join(directory, "compose.yml"),
        ...args,
      ],
      { env: composeEnv, timeout: 180_000 },
    );
  try {
    await copyFile("compose.yml", join(directory, "compose.yml"));
    // All values are harness decoys, never operator dotenv input.
    await writeFile(
      join(directory, ".env"),
      "PORT=8080\nHOSTNAME=invalid.example\nNODE_ENV=development\nNEXT_TELEMETRY_DISABLED=0\nKEEP_ALIVE_TIMEOUT=1\n",
    );
    let identity: {
      artifactId: string;
      deploymentId: string;
      buildNonce: string;
      sourceTreeHash: string;
      version: string;
      sourceCommit: string | null;
      architecture: string;
    };
    await check("image/identity/filesystem", async () => {
      const metadata = (await json("image", "inspect", image))[0];
      // Resolve a mutable tag once; every later container must use this image.
      image = metadata.Id;
      composeEnv.FEEDBACKLAND_IMAGE = image;
      assert.equal(metadata.Config.User, "node");
      assert.deepEqual(metadata.Config.Cmd, ["node", "server.js"]);
      assert(!metadata.Config.Entrypoint?.length);
      assert.equal(metadata.Os, "linux");
      const encoded = await docker(
        "run",
        "--rm",
        "--network",
        "none",
        "--entrypoint",
        "node",
        image,
        "-e",
        "console.log(require('fs').readFileSync('/app/build-identity.json','utf8'))",
      );
      identity = JSON.parse(encoded);
      const local = JSON.parse(
        await readFile("lib/build-identity.json", "utf8"),
      );
      assert.equal(
        identity.sourceTreeHash,
        local.sourceTreeHash,
        "image does not match checkout source tree",
      );
      assert.equal(
        identity.sourceCommit,
        local.sourceCommit,
        "image source commit differs",
      );
      assert.match(identity.artifactId, /^[a-f0-9]{64}$/);
      assert.match(identity.buildNonce, /^[a-f0-9]{32}$/);
      assert.equal(identity.deploymentId, identity.artifactId.slice(0, 32));
      assert.equal(
        identity.architecture,
        metadata.Architecture === "amd64" ? "x64" : metadata.Architecture,
      );
      const bundled = JSON.parse(
        await docker(
          "run",
          "--rm",
          "--network",
          "none",
          "--entrypoint",
          "node",
          image,
          "-e",
          "const f=require('fs');console.log(JSON.stringify({buildId:f.readFileSync('/app/.next/BUILD_ID','utf8').trim(),deploymentId:JSON.parse(f.readFileSync('/app/.next/required-server-files.json','utf8')).config.deploymentId}))",
        ),
      );
      assert.equal(bundled.buildId, identity.artifactId);
      assert.equal(bundled.deploymentId, identity.deploymentId);
      assert.match(bundled.deploymentId, /^[a-f0-9]{32}$/);
      const forbidden = await docker(
        "run",
        "--rm",
        "--network",
        "none",
        "--user",
        "0",
        "--entrypoint",
        "sh",
        image,
        "-c",
        "find / -xdev \\( -name '.env*' -o -name sharp -o -name '@img' \\) -print 2>/dev/null; test ! -d /app/scripts; test -z \"$(find /app -xdev ! -user root -print -quit)\"",
      );
      assert.equal(forbidden, "", "forbidden file found in final image");
      const manifest = JSON.parse(
        await docker(
          "run",
          "--rm",
          "--network",
          "none",
          "--entrypoint",
          "node",
          image,
          "-e",
          "console.log(require('fs').readFileSync('/app/.next/prerender-manifest.json','utf8'))",
        ),
      );
      for (const route of Object.keys(manifest.routes)) {
        assert(
          !/^\/(?:$|admin(?:\/|$)|setup(?:\/|$)|recover$|reset-password$)/.test(
            route,
          ),
          `prerendered board route ${route}`,
        );
      }
      return {
        imageId: metadata.Id,
        sourceCommit: identity.sourceCommit,
        artifactId: identity.artifactId,
        architecture: metadata.Architecture,
        forbiddenFiles: 0,
        prerenderedRoutes: Object.keys(manifest.routes),
      };
    });
    await check("compose/runtime-invariants", async () => {
      const config = JSON.parse(await compose("config", "--format", "json"));
      const env = config.services.app.environment;
      for (const [key, value] of Object.entries({
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        KEEP_ALIVE_TIMEOUT: "65000",
      }))
        assert.equal(env[key], value);
      assert.equal(config.services.db.ports, undefined);
      assert.equal(config.services.db.volumes[0].target, "/var/lib/postgresql");
      assert.equal(config.services.app.read_only, true);
      projectCreated = true;
      await compose("up", "-d", "--wait", "--wait-timeout", "120");
      const appId = await compose("ps", "-q", "app");
      const state = await inspect(appId);
      assert.equal(state.Image, image);
      assert.equal(state.HostConfig.ReadonlyRootfs, true);
      assert.deepEqual(Object.keys(state.HostConfig.Tmpfs).sort(), [
        "/app/.next/cache",
        "/tmp",
      ]);
      assert(state.HostConfig.CapDrop.includes("ALL"));
      const port = state.NetworkSettings.Ports["3000/tcp"][0].HostPort;
      const url = `http://127.0.0.1:${port}`;
      const result = await health(url);
      assert.equal(result.status, 200);
      assert.equal(result.body.version, identity!.version);
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
          "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
        ),
        "0",
      );
      assert.equal((await fetch(`${url}/get-started`)).status, 200);
      const writable = await compose(
        "exec",
        "-T",
        "app",
        "node",
        "-e",
        "const f=require('fs'); f.writeFileSync('/tmp/probe','ok');f.writeFileSync('/app/.next/cache/probe','ok');try{f.writeFileSync('/app/forbidden','x');process.exit(1)}catch(e){if(!['EROFS','EACCES'].includes(e.code))throw e}console.log('bounded writes passed')",
      );
      assert.equal(writable, "bounded writes passed");
      return {
        constants: "passed",
        readOnly: true,
        emptyDatabase: result,
        staticPage: "/get-started",
        writes: "only declared tmpfs",
      };
    });
    await check("readiness/outage-concurrency-recovery", async () => {
      const appId = await compose("ps", "-q", "app");
      const state = await inspect(appId);
      const url = `http://127.0.0.1:${state.NetworkSettings.Ports["3000/tcp"][0].HostPort}`;
      const dbId = await compose("ps", "-q", "db");
      await docker("pause", dbId);
      let storm;
      try {
        storm = await Promise.all(
          Array.from({ length: 40 }, () => health(url)),
        );
        for (const response of storm) {
          assert.equal(response.status, 503);
          assert(response.elapsedMs < 2_500);
        }
      } finally {
        await docker("unpause", dbId);
      }
      await eventually(
        () => health(url),
        (response) => response.status === 200,
      );
      await compose("stop", "db");
      const down = await eventually(
        () => health(url),
        (response) => response.status === 503,
      );
      assert(down.elapsedMs < 2_500);
      await compose("start", "db");
      const recovered = await eventually(
        () => health(url),
        (response) => response.status === 200,
      );
      const final = await inspect(appId);
      assert.equal(final.RestartCount, 0);
      const logs = await compose("logs", "--no-color", "app");
      assert.doesNotMatch(logs, /unhandled|password|postgres:\/\//i);
      return {
        concurrentRequests: 40,
        maximumMs: Math.max(...storm!.map((item) => item.elapsedMs)),
        stoppedDatabase: down,
        restoredDatabase: recovered,
        restarts: 0,
      };
    });
    await check("direct-image/port-hostname", async () => {
      networkCreated = true;
      await docker("network", "create", network);
      const dbId = await compose("ps", "-q", "db");
      await docker("network", "connect", "--alias", "db", network, dbId);
      const runtime = [
        "--read-only",
        "--tmpfs",
        "/tmp:size=64m",
        "--tmpfs",
        "/app/.next/cache:size=64m",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--network",
        network,
        "-e",
        "DATABASE_URL=postgres://postgres:feedbackland@db:5432/feedbackland",
      ];
      containers.push(direct);
      await docker(
        "run",
        "-d",
        "--name",
        direct,
        "--hostname",
        "bogus",
        ...runtime,
        "-e",
        "PORT=8080",
        "-p",
        "127.0.0.1::8080",
        image,
      );
      const state = await inspect(direct);
      assert.equal(state.Image, image);
      const url = `http://127.0.0.1:${state.NetworkSettings.Ports["8080/tcp"][0].HostPort}`;
      const result = await eventually(
        () => health(url),
        (response) => response.status === 200,
      );
      assert.equal(
        await docker("exec", direct, "node", "-p", "process.env.HOSTNAME"),
        "0.0.0.0",
      );
      containers.push(bad);
      await docker(
        "run",
        "-d",
        "--name",
        bad,
        ...runtime,
        "-e",
        "HOSTNAME=bogus.invalid",
        image,
      );
      const failed = await eventually(
        () => inspect(bad),
        (value) => value.State.Status === "exited",
        30_000,
      );
      assert.equal(failed.State.ExitCode, 1);
      const logs = await docker("logs", bad);
      assert.match(logs, /ENOTFOUND/);
      assert.match(logs, /bogus.invalid/);
      return {
        port: 8080,
        dockerHostnameOverridden: true,
        readiness: result,
        explicitBadHostnameExit: failed.State.ExitCode,
      };
    });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await check("cleanup", async () => {
        // Every name is generated here. Never touch operator projects or volumes.
        const failures: string[] = [];
        for (const name of containers.reverse()) {
          try {
            await docker("rm", "-f", name);
          } catch (error) {
            failures.push(String(error));
          }
        }
        if (projectCreated) {
          try {
            await compose("down", "--volumes", "--remove-orphans");
          } catch (error) {
            failures.push(String(error));
          }
        }
        if (networkCreated) {
          try {
            await docker("network", "rm", network);
          } catch (error) {
            failures.push(String(error));
          }
        }
        // mkdtemp returns a task-owned absolute directory; no computed workspace delete.
        await rm(directory, { recursive: true, force: true });
        if (failures.length)
          throw new Error(
            `test resource cleanup failed: ${failures.join("; ")}`,
          );
        return {
          project,
          temporaryDirectoryRemoved: true,
          resourceCleanup: "passed",
        };
      });
    } catch (cleanupError) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanupError],
          "Verification and cleanup failed",
        );
      throw cleanupError;
    }
  }
}
