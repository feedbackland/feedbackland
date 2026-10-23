import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client, Pool } from "pg";
import { parseDatabaseOptions } from "../../lib/config";
import { command, eventually } from "./run";

type Check = (name: string, action: () => Promise<unknown>) => Promise<void>;
const docker = (...args: string[]) => command("docker", args);
const inspect = async (name: string) =>
  JSON.parse(await docker("inspect", name))[0];
const pg18 =
  "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11";
function node(
  script: string,
  args: string[],
  url: string,
  extra: Record<string, string> = {},
) {
  return command(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", script, ...args],
    { env: { DATABASE_URL: url, ...extra }, timeout: 150_000 },
  );
}
function fixtureUrl(
  port: string,
  database = "feedbackland",
  host = "127.0.0.1",
) {
  return `postgres://postgres:fixture-only@${host}:${port}/${database}`;
}
async function withDb<T>(url: string, action: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ ...parseDatabaseOptions(url), max: 3 });
  try {
    return await action(pool);
  } finally {
    await pool.end();
  }
}
export async function phaseOne(image: string, runId: string, check: Check) {
  assert(
    (await readdir(".")).every(
      (file) => !file.startsWith(".env") || file === ".env.example",
    ),
    "Use an isolated checkout without operator dotenv files",
  );
  assert.match(runId, /^p0[23]-[0-9]+-[a-f0-9]+$/);
  await check("client/settings-drafts-and-revisions", () =>
    command(process.execPath, [
      "--import",
      "tsx",
      "scripts/e2e/settings-browser.ts",
    ]),
  );
  const project = `${runId}-db`,
    tlsProject = `${runId}-tls`,
    certificateVolume = `${runId}-certs`;
  const directory = await mkdtemp(join(tmpdir(), `${runId}-`));
  const envFile = join(directory, ".env");
  await writeFile(envFile, "");
  const containers: string[] = [];
  const projects: Array<{ name: string; files: string[] }> = [];
  let volumeCreated = false;
  const topology = ["ci/compose.pgbouncer.yml", "ci/compose.pg15.yml"];
  const compose = (
    name: string,
    files: string[],
    args: string[],
    extra: Record<string, string> = {},
  ) =>
    command(
      "docker",
      [
        "compose",
        "--project-name",
        name,
        "--env-file",
        envFile,
        ...files.flatMap((file) => ["-f", resolve(file)]),
        ...args,
      ],
      { env: extra, timeout: 180_000 },
    );
  const portFor = async (
    name: string,
    files: string[],
    service: string,
    extra: Record<string, string> = {},
  ) => {
    const id = await compose(name, files, ["ps", "-q", service], extra);
    const state = await inspect(id);
    return state.NetworkSettings.Ports["5432/tcp"][0].HostPort as string;
  };
  let primaryError: unknown;
  try {
    projects.push({ name: project, files: topology });
    await compose(project, topology, [
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "90",
    ]);
    const port18 = await portFor(project, topology, "db"),
      port15 = await portFor(project, topology, "pg15"),
      poolerPort = await portFor(project, topology, "pooler");
    const adminUrl = fixtureUrl(port18);
    await withDb(adminUrl, async (pool) => {
      for (const name of [
        "app768",
        "app3072",
        "auth_ddl",
        "concurrent",
        "http",
        "dev",
        "invalid",
      ])
        await pool.query(`create database "${name}"`);
    });
    await check("schema/pg15-pg18-dimensions-ddl-types", async () => {
      const cases = [15, 18].flatMap((major) =>
        ["public", "extensions"].flatMap((schema) =>
          ["768", "3072"].map((dimensions) => ({
            major,
            schema,
            dimensions,
            database: `matrix_${major}_${schema}_${dimensions}`,
            url: fixtureUrl(
              major === 15 ? port15 : port18,
              `matrix_${major}_${schema}_${dimensions}`,
            ),
          })),
        ),
      );
      const evidence = [];
      for (const fixture of cases) {
        await withDb(
          fixtureUrl(fixture.major === 15 ? port15 : port18),
          (pool) => pool.query(`create database "${fixture.database}"`),
        );
        await withDb(fixture.url, async (pool) => {
          assert.equal(
            Math.floor(
              Number(
                (await pool.query("show server_version_num")).rows[0]
                  .server_version_num,
              ) / 10_000,
            ),
            fixture.major,
          );
          if (fixture.schema !== "public")
            await pool.query(
              "create schema extensions; create extension vector with schema extensions",
            );
        });
        const output = await node(
          "scripts/e2e/database-worker.ts",
          [],
          fixture.url,
          {
            AI_EMBEDDING_DIMENSIONS: fixture.dimensions,
            ...(fixture.schema === "extensions"
              ? {
                  BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
                  SETUP_CODE: randomBytes(32).toString(
                    fixture.major === 15 && fixture.dimensions === "3072"
                      ? "base64"
                      : "hex",
                  ),
                }
              : {}),
          },
        );
        evidence.push({
          major: fixture.major,
          ...JSON.parse(output.split(/\r?\n/).at(-1)!),
        });
        await node("scripts/codegen.ts", ["--verify"], fixture.url);
      }
      await node(
        "scripts/print-auth-ddl.ts",
        ["--verify"],
        fixtureUrl(port18, "auth_ddl"),
      );
      await assert.rejects(
        node(
          "scripts/e2e/database-worker.ts",
          ["boot-only"],
          fixtureUrl(port18, "invalid"),
          { AI_EMBEDDING_DIMENSIONS: "4096" },
        ),
        /AI_EMBEDDING_DIMENSIONS/,
      );
      await withDb(fixtureUrl(port18, "invalid"), async (pool) =>
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as count from information_schema.tables where table_schema='public'",
            )
          ).rows[0].count,
          0,
        ),
      );
      return {
        databases: evidence,
        authDdl: "exact match",
        generatedTypes: "all eight combinations match",
        invalidWidth4096: "refused before migration",
        existingSchema: await node(
          "scripts/e2e/database-worker.ts",
          ["existing-schema"],
          fixtureUrl(port18, "invalid"),
        ),
      };
    });
    await check("boot/failure-pooler-concurrency", async () => {
      const pooled = fixtureUrl(poolerPort);
      await eventually(
        () => withDb(pooled, (pool) => pool.query("select 1")),
        () => true,
        30_000,
      );
      await node("scripts/e2e/database-worker.ts", ["failure"], pooled);
      const url = fixtureUrl(port18, "concurrent");
      const blocker = new Client(parseDatabaseOptions(url));
      await blocker.connect();
      try {
        await blocker.query(
          "begin; select pg_advisory_xact_lock(4702111234474983745)",
        );
        const attempts = [
          node("scripts/e2e/database-worker.ts", ["boot-only"], url),
          node("scripts/e2e/database-worker.ts", ["boot-only"], url),
        ];
        await eventually(
          async () => {
            await blocker.query("select pg_stat_clear_snapshot()");
            return (
              await blocker.query(
                "select count(*)::int as count from pg_stat_activity where datname=current_database() and wait_event='advisory' and pid<>pg_backend_pid()",
              )
            ).rows[0].count;
          },
          (count) => count === 2,
          30_000,
        );
        await blocker.query("commit");
        const output = await Promise.all(attempts);
        assert(
          output.every((text) => text.includes("boot.waiting-for-migration")),
        );
      } finally {
        await blocker.query("rollback").catch(() => {});
        await blocker.end();
      }
      await withDb(url, async (pool) => {
        for (const table of [
          "settings",
          "instance_secret",
          "ai_settings",
          "auth_runtime",
          "kysely_migration",
        ])
          assert.equal(
            (await pool.query(`select count(*)::int as count from "${table}"`))
              .rows[0].count,
            1,
          );
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as count from pg_locks where locktype='advisory' and pid<>pg_backend_pid()",
            )
          ).rows[0].count,
          0,
        );
      });
      return {
        concurrentBlockedBoots: 2,
        committedMigrations: 1,
        originalFailure: "42P01",
        rollbackAndRetry: "passed through transaction-mode PgBouncer",
        sessionLocksRemaining: 0,
      };
    });
    await check("tls/policies-chain-hostname-expiry", async () => {
      volumeCreated = true;
      await docker("volume", "create", certificateVolume);
      const generate =
        "set -eu; cd /certs; openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -subj /CN=FixtureCA -days 2 >/dev/null 2>&1; openssl req -x509 -newkey rsa:2048 -nodes -keyout wrong.key -out wrong.crt -subj /CN=WrongCA -days 2 >/dev/null 2>&1; openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj /CN=localhost >/dev/null 2>&1; echo subjectAltName=DNS:localhost > extensions; openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 2 -extfile extensions >/dev/null 2>&1; openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out expired.crt -days 0 -extfile extensions >/dev/null 2>&1; cp server.crt valid.crt; chown -R postgres:postgres /certs; chmod 600 server.key";
      await docker(
        "run",
        "--rm",
        "-v",
        `${certificateVolume}:/certs`,
        "--entrypoint",
        "sh",
        pg18,
        "-c",
        generate,
      );
      const ca = await docker(
        "run",
        "--rm",
        "-v",
        `${certificateVolume}:/certs:ro`,
        "--entrypoint",
        "cat",
        pg18,
        "/certs/ca.crt",
      );
      const wrong = await docker(
        "run",
        "--rm",
        "-v",
        `${certificateVolume}:/certs:ro`,
        "--entrypoint",
        "cat",
        pg18,
        "/certs/wrong.crt",
      );
      const files = ["ci/compose.private-ca.yml"],
        env = { FIXTURE_CERT_VOLUME: certificateVolume };
      projects.push({ name: tlsProject, files });
      await compose(
        tlsProject,
        files,
        ["up", "-d", "--wait", "--wait-timeout", "90"],
        env,
      );
      const port = await portFor(tlsProject, files, "tls-db", env);
      const connect = async (url: string, certificate?: string) => {
        const client = new Client({
          ...parseDatabaseOptions(url, certificate),
          connectionTimeoutMillis: 3000,
          query_timeout: 3000,
        });
        client.on("error", () => {});
        try {
          await client.connect();
          return (
            await client.query(
              "select ssl from pg_stat_ssl where pid=pg_backend_pid()",
            )
          ).rows[0].ssl as boolean;
        } finally {
          await client.end().catch(() => {});
        }
      };
      const local = fixtureUrl(port, "feedbackland", "localhost"),
        ip = fixtureUrl(port);
      assert.equal(await connect(local), false);
      for (const selector of ["ssl=false", "sslmode=disable"])
        assert.equal(await connect(`${local}?${selector}`), false);
      for (const selector of ["sslmode=require", "sslmode=prefer"])
        assert.equal(await connect(`${local}?${selector}`), true);
      for (const selector of ["ssl=true", "sslmode=verify-full"])
        assert.equal(await connect(`${local}?${selector}`, ca), true);
      assert.equal(await connect(local, ca), true); // CA-only must imply verification.
      assert.equal(await connect(`${ip}?sslmode=verify-ca`, ca), true); // Name deliberately skipped.
      for (const selector of ["ssl=true", "sslmode=verify-full"]) {
        await assert.rejects(
          connect(`${local}?${selector}`),
          /certificate|issuer|self.signed/i,
        );
        await assert.rejects(
          connect(`${ip}?${selector}`, ca),
          /IP|altname|certificate/i,
        );
        await assert.rejects(
          connect(`${local}?${selector}`, wrong),
          /certificate|issuer|self.signed/i,
        );
      }
      await assert.rejects(
        connect(local, wrong),
        /certificate|issuer|self.signed/i,
      );
      await assert.rejects(
        connect(`${local}?sslmode=verify-ca`, wrong),
        /certificate|issuer|self.signed/i,
      );
      await docker(
        "run",
        "--rm",
        "-v",
        `${certificateVolume}:/certs`,
        "--entrypoint",
        "sh",
        pg18,
        "-c",
        "cp /certs/expired.crt /certs/server.crt",
      );
      await compose(
        tlsProject,
        files,
        [
          "exec",
          "-T",
          "tls-db",
          "psql",
          "-U",
          "postgres",
          "-d",
          "feedbackland",
          "-c",
          "select pg_reload_conf()",
        ],
        env,
      );
      await eventually(
        async () => {
          try {
            await connect(`${local}?sslmode=verify-full`, ca);
            return false;
          } catch (error) {
            return /expired/i.test(String(error));
          }
        },
        Boolean,
        10_000,
      );
      await assert.rejects(
        connect(`${local}?sslmode=verify-ca`, ca),
        /expired/i,
      );
      return {
        plaintextPolicies: 3,
        encryptedUnverifiedPolicies: 2,
        verifiedPolicies: 4,
        pgStatSsl: "checked on every accepted connection",
        untrustedChain: "refused",
        wrongHostnameAndIp: "refused",
        expiredCertificate: "refused",
        malformedAndConflictingSelectors: "parser gate",
      };
    });
    await check("standalone/public-persistence-secrets-pools", async () => {
      const app = `${runId}-app`,
        dbId = await compose(project, topology, ["ps", "-q", "db"]);
      const network = Object.keys(
        (await inspect(dbId)).NetworkSettings.Networks,
      )[0];
      const auth = randomBytes(32).toString("base64url"),
        setup = randomBytes(32).toString("hex");
      containers.push(app);
      await docker(
        "run",
        "-d",
        "--name",
        app,
        "--network",
        network,
        "--read-only",
        "--tmpfs",
        "/tmp:size=64m",
        "--tmpfs",
        "/app/.next/cache:size=64m",
        "-p",
        "127.0.0.1::3000",
        "-e",
        "DATABASE_URL=postgres://postgres:fixture-only@db:5432/http",
        "-e",
        "DATABASE_POOL_MAX=2",
        "-e",
        `BETTER_AUTH_SECRET=${auth}`,
        "-e",
        `SETUP_CODE=${setup}`,
        "-e",
        "OPENROUTER_API_KEY=fixture-ignored-model-key",
        image,
      );
      const state = await inspect(app);
      let url = `http://127.0.0.1:${state.NetworkSettings.Ports["3000/tcp"][0].HostPort}`;
      await eventually(
        async () => (await fetch(`${url}/api/health`)).status,
        (status) => status === 200,
      );
      const root = await fetch(url),
        html = await root.text();
      assert.equal(root.status, 200);
      assert.equal(root.headers.get("location"), null);
      assert(html.includes("Feedback"));
      const publicRead = await fetch(`${url}/api/settings`),
        settings = await publicRead.json();
      assert.equal(publicRead.headers.get("cache-control"), "no-store");
      assert(publicRead.headers.get("etag"));
      assert.deepEqual(
        Object.keys(settings).sort(),
        [
          "platformTitle",
          "platformDescription",
          "logoUrl",
          "allowIndexing",
          "isSetupComplete",
          "appUrl",
          "appUrlInferred",
          "version",
          "buildIdentity",
          "publicVersion",
          "capabilities",
        ].sort(),
      );
      assert.equal(settings.capabilities.chat, false);
      assert.equal(settings.capabilities.embeddings, false);
      const cookieRead = await fetch(`${url}/api/settings`, {
        headers: {
          Cookie: "fixture=fake-admin",
          Authorization: "Bearer fixture",
        },
      });
      assert.deepEqual(await cookieRead.json(), settings);
      const fixture = JSON.parse(
        await readFile("ci/fixtures/legacy-input.json", "utf8"),
      );
      const create = await fetch(`${url}/api/feedback/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://host.fixture.invalid",
        },
        body: JSON.stringify(fixture),
      });
      assert.equal(create.status, 201);
      assert.equal(create.headers.get("access-control-allow-origin"), "*");
      const body = await create.json();
      assert.deepEqual(Object.keys(body), ["id"]);
      const query = async (procedure: string, input: unknown) => {
        const response = await fetch(
          `${url}/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`,
        );
        assert.equal(
          response.status,
          200,
          `${procedure}: ${await response.clone().text()}`,
        );
        return (await response.json()).result.data.json;
      };
      const posts = await query("getFeedbackPosts", {
        limit: 20,
        orderBy: "newest",
        status: null,
        searchValue: "",
        cursor: null,
      });
      assert(
        posts.feedbackPosts.some((post: { id: string }) => post.id === body.id),
      );
      assert.equal(
        (await query("getFeedbackPost", { postId: body.id })).id,
        body.id,
      );
      assert.deepEqual(
        (
          await query("getComments", {
            postId: body.id,
            limit: 20,
            cursor: null,
          })
        ).comments,
        [],
      );
      assert.equal(
        (await query("getFeedbackPostsByIds", { ids: [body.id] }))[0].id,
        body.id,
      );
      for (const payload of [
        {},
        { description: "" },
        { description: "x".repeat(10001) },
      ]) {
        const response = await fetch(`${url}/api/feedback/create`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        assert.equal(response.status, 400);
        assert.equal(response.headers.get("access-control-allow-origin"), "*");
      }
      const options = await fetch(`${url}/api/feedback/create`, {
        method: "OPTIONS",
      });
      assert.equal(options.status, 204);
      assert.equal(
        options.headers.get("access-control-allow-methods"),
        "POST, OPTIONS",
      );
      assert.equal(options.headers.get("access-control-max-age"), "86400");
      const residue = JSON.parse(
        await readFile("ci/fixtures/residue.json", "utf8"),
      );
      assert.equal(
        (
          await fetch(url + residue.removedRoute, {
            method: "POST",
            body: "{}",
          })
        ).status,
        404,
      );
      for (const endpoint of [
        "updateSettings",
        "createComment",
        "deleteAdmin",
        "generateInsights",
      ]) {
        const response = await fetch(`${url}/api/trpc/${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: "fixture=fake-admin",
            Authorization: "Bearer fixture",
          },
          body: JSON.stringify({ json: {} }),
        });
        assert.equal(response.status, 401, endpoint);
      }
      assert.equal(
        (await fetch(`${url}/api/chat`, { method: "POST" })).status,
        401,
      );
      const rewrite = await fetch(`${url}/api/trpc/rewriteFeedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { description: "Improve" } }),
      });
      assert.equal(rewrite.status, 412);
      assert((await rewrite.text()).includes("AI_NOT_CONFIGURED"));
      await Promise.all(
        Array.from({ length: 24 }, (_, i) =>
          fetch(
            i % 3 === 0
              ? url
              : `${url}/api/${i % 3 === 1 ? "settings" : "health"}`,
          ).then((response) => {
            assert.equal(response.status, 200);
            return response.text();
          }),
        ),
      );
      const evidence = await withDb(
        fixtureUrl(port18, "http"),
        async (pool) => {
          const secrets = (
            await pool.query(
              'select "authSecret","setupCode" from instance_secret where id=1',
            )
          ).rows[0];
          assert.notEqual(secrets.authSecret, auth);
          assert.equal(secrets.setupCode, setup);
          for (const secret of [auth, setup, secrets.authSecret].filter(
            Boolean,
          )) {
            assert(!html.includes(secret));
            assert(!JSON.stringify(settings).includes(secret));
          }
          const clients = (
            await pool.query(
              "select count(*)::int as count from pg_stat_activity where datname=current_database() and application_name='feedbackland-app'",
            )
          ).rows[0].count;
          assert.equal(
            clients,
            1,
            "Separate bundle layers created extra pools",
          );
          const post = (
            await pool.query(
              'select "authorId",revision,"moderationState",embedding from feedback where id=$1',
              [body.id],
            )
          ).rows[0];
          assert.equal(post.authorId, null);
          assert.equal(post.revision, "1");
          assert.equal(post.moderationState, "disabled");
          assert.equal(post.embedding, null);
          return {
            sharedAppConnectionsAcrossLayers: clients,
            configuredTotal: 2,
          };
        },
      );
      await docker("restart", app);
      const restarted = await inspect(app);
      url = `http://127.0.0.1:${restarted.NetworkSettings.Ports["3000/tcp"][0].HostPort}`;
      await eventually(
        async () => (await fetch(`${url}/api/health`)).status,
        (status) => status === 200,
      );
      await withDb(fixtureUrl(port18, "http"), async (pool) =>
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as count from feedback where id=$1",
              [body.id],
            )
          ).rows[0].count,
          1,
        ),
      );
      await withDb(fixtureUrl(port18, "http"), async (pool) => {
        await pool.query("alter table feedback rename to feedback_fixture");
        try {
          const failure = await fetch(`${url}/api/feedback/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: "Failed database write" }),
          });
          assert.equal(failure.status, 500);
          assert.equal(failure.headers.get("access-control-allow-origin"), "*");
          assert.deepEqual(await failure.json(), {
            error: "CONTENT_UNAVAILABLE",
          });
        } finally {
          await pool.query("alter table feedback_fixture rename to feedback");
        }
      });
      const logs = await docker("logs", app);
      for (const secret of [auth, setup, "fixture-ignored-model-key"])
        assert(!logs.includes(secret));
      assert.doesNotMatch(logs, /postgres:\/\/|unhandled|PRIVATE KEY/i);
      return {
        root: 200,
        anonymousCreate: 201,
        restartPersistence: "passed",
        corsOnSuccessAndValidation: "passed",
        protectedRoutes: "unauthorized",
        publicAi: "AI_NOT_CONFIGURED",
        publicSettingsSecrets: "absent",
        injectedSecretsInDatabaseAndLogs: "absent",
        ...evidence,
      };
    });
    await check("boot/runtime-fatal-bounds", async () => {
      const cases = [
        {
          name: "missing",
          env: [],
          maximum: 15_000,
          match: /DATABASE_URL is not set/,
        },
        {
          name: "unreachable",
          env: [
            "DATABASE_URL=postgres://fixture:fixture-only@127.0.0.1:1/fixture",
          ],
          maximum: 100_000,
          match: /boot.fatal/,
        },
        {
          name: "invalid-tls",
          env: [
            "DATABASE_URL=postgres://fixture:fixture-only@127.0.0.1:1/fixture?ssl=true&sslmode=require",
          ],
          maximum: 15_000,
          match: /ssl and sslmode conflict/,
        },
      ];
      const evidence = [];
      for (const fixture of cases) {
        const name = `${runId}-${fixture.name}`,
          start = Date.now();
        containers.push(name);
        await docker(
          "run",
          "-d",
          "--name",
          name,
          "--network",
          "none",
          ...fixture.env.flatMap((value) => ["-e", value]),
          image,
        );
        const exit = await command("docker", ["wait", name], {
          timeout: fixture.maximum + 5000,
        });
        assert.equal(exit, "1");
        assert(Date.now() - start < fixture.maximum);
        assert.match(await docker("logs", name), fixture.match);
        evidence.push({
          case: fixture.name,
          exit: 1,
          elapsedMs: Date.now() - start,
        });
      }
      return evidence;
    });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await check("phase1/cleanup", async () => {
        const failures: string[] = [];
        for (const name of containers.reverse())
          try {
            await docker("rm", "-f", name);
          } catch (error) {
            failures.push(String(error));
          }
        for (const item of projects.reverse())
          try {
            await compose(
              item.name,
              item.files,
              ["down", "--volumes", "--remove-orphans"],
              { FIXTURE_CERT_VOLUME: certificateVolume },
            );
          } catch (error) {
            failures.push(String(error));
          }
        if (volumeCreated)
          try {
            await docker("volume", "rm", certificateVolume);
          } catch (error) {
            failures.push(String(error));
          }
        await rm(directory, { recursive: true, force: true });
        if (failures.length) throw new Error(failures.join("\n"));
        return {
          ownedProjectsRemoved: projects.length,
          ownedContainersRemoved: containers.length,
          ownedCertificateVolumeRemoved: volumeCreated,
        };
      });
    } catch (cleanup) {
      if (primaryError)
        throw new AggregateError(
          [primaryError, cleanup],
          "Phase 1 and cleanup failed",
        );
      throw cleanup;
    }
  }
}
