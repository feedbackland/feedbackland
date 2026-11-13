import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { networkInterfaces } from "node:os";
import { createServer, connect } from "node:net";
import { once } from "node:events";
import { signIn } from "./v3-auth";
import { join } from "node:path";
import { Pool } from "pg";
import { chromium } from "playwright";
import { command, eventually, toolEnvironment } from "./run";
import { submitSetup, fixturePassword } from "./setup-browser";
import { imageBrowser } from "./image-browser";
import { samples, exifJpeg } from "./image-fixtures";
import { sendImage, streamContracts } from "./image-http-contracts";
type Check = (name: string, action: () => Promise<unknown>) => Promise<void>;
const pgImage =
  "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11";
async function snapshot(pool: Pool) {
  const tables = await pool.query<{ name: string }>(
    "select tablename as name from pg_tables where schemaname='public' order by 1",
  );
  const counts: Record<string, number> = {};
  for (const { name } of tables.rows) {
    assert(/^[a-z_]+$/.test(name));
    counts[name] = Number(
      (await pool.query('select count(*) from "' + name + '"')).rows[0].count,
    );
  }
  const images = (
    await pool.query(
      "select id, encode(sha256(bytes),'hex') as hash from images order by id",
    )
  ).rows;
  const refs = (
    await pool.query(
      'select "imageId","postId","commentId" from image_ref order by 1,2,3',
    )
  ).rows;
  const logo = (await pool.query('select "logoImageId" as id from settings'))
    .rows[0].id;
  return { counts, images, refs, logo };
}
export async function phaseFive(
  image: string,
  runId: string,
  directory: string,
  check: Check,
) {
  assert.match(runId, /^p06-\d+-[a-f0-9]+$/);
  const project = runId + "-images",
    database = project + "-db";
  const docker = (...args: string[]) =>
    command("docker", args, { timeout: 120000 });
  const containers: string[] = [],
    pools: Pool[] = [];
  const password = randomBytes(20).toString("hex"),
    setup = randomBytes(32).toString("hex");
  let network = false,
    dbPort = "";
  const poolFor = (name: string) => {
    const p = new Pool({
      connectionString:
        "postgres://postgres:" + password + "@127.0.0.1:" + dbPort + "/" + name,
    });
    pools.push(p);
    return p;
  };
  const worker = (
    name: string,
    action: string,
    env: Record<string, string> = {},
  ) =>
    command(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "scripts/e2e/image-storage-contracts.ts",
        action,
      ],
      {
        env: {
          DATABASE_URL:
            "postgres://postgres:" +
            password +
            "@127.0.0.1:" +
            dbPort +
            "/" +
            name,
          ...env,
        },
      },
    );
  const startApp = async (suffix: string, db: string, env: string[] = []) => {
    const name = project + "-" + suffix;
    await docker(
      "run",
      "-d",
      "--name",
      name,
      "--network",
      project,
      "-p",
      "127.0.0.1::3000",
      "--read-only",
      "--tmpfs",
      "/tmp:size=64m",
      "--tmpfs",
      "/app/.next/cache:size=64m",
      "-e",
      "DATABASE_URL=postgres://postgres:" + password + "@db/" + db,
      "-e",
      "SETUP_CODE=" + setup,
      ...env.flatMap((v) => ["-e", v]),
      image,
    );
    containers.push(name);
    const port = JSON.parse(await docker("inspect", name))[0].NetworkSettings
      .Ports["3000/tcp"][0].HostPort;
    const base = "http://localhost:" + port;
    await eventually(
      () => fetch(base + "/api/health").then((r) => r.status),
      (v) => v === 200,
    );
    return { base, name };
  };
  let primary: unknown;
  try {
    await check("images/container-framing-deadlines", async () =>
      JSON.parse(
        await command(process.execPath, [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/e2e/v20-images.ts",
        ]),
      ),
    );
    await docker("network", "create", project);
    network = true;
    await docker(
      "run",
      "-d",
      "--name",
      database,
      "--network",
      project,
      "--network-alias",
      "db",
      "--tmpfs",
      "/var/lib/postgresql:size=768m",
      "--tmpfs",
      "/private:mode=0700",
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_PASSWORD=" + password,
      pgImage,
    );
    containers.push(database);
    await eventually(
      () =>
        docker(
          "exec",
          database,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
        ),
      (v) => v.includes("accepting connections"),
    );
    dbPort = JSON.parse(await docker("inspect", database))[0].NetworkSettings
      .Ports["5432/tcp"][0].HostPort;
    const pool = poolFor("postgres"),
      app = await startApp("a", "postgres");
    let imagePath = "",
      logoPath = "";
    await check("images/primary-browser-flow", async () => {
      assert.equal((await sendImage(app.base)).status, 403);
      const browser = await chromium.launch({
        env: toolEnvironment() as Record<string, string>,
      });
      try {
        const page = await browser.newPage();
        await submitSetup(page, app.base, setup);
        const result = await imageBrowser(
          page,
          app.base,
          join(directory, "attachment-walkthrough.png"),
        ).catch(async (error) => {
          const state = (
            await pool.query(
              'select description from feedback order by "createdAt"',
            )
          ).rows.map((r) => r.description);
          throw new Error(
            String(error) +
              " on " +
              new URL(page.url()).pathname +
              "; image sources " +
              JSON.stringify(
                await page
                  .locator("img")
                  .evaluateAll((els) =>
                    els.map((el) => el.getAttribute("src")?.split("?")[0]),
                  ),
              ) +
              "; saved fixture posts " +
              JSON.stringify(state),
          );
        });
        imagePath = result.imageUrl;
        logoPath = result.logoUrl;
        // Bind an ephemeral port on this host's private interface. Only the local browser can relay through it.
        const ips = Object.values(networkInterfaces())
          .flat()
          .filter((ip) => ip?.family === "IPv4" && !ip.internal)
          .map((ip) => ip!.address);
        const lanIp =
          ips.find((ip) => ip.startsWith("192.168.")) ??
          ips.find((ip) => /^(10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip));
        assert(
          lanIp,
          "A private IPv4 interface is needed for the plain HTTP LAN walkthrough",
        );
        const sockets = new Set<import("node:net").Socket>();
        const relay = createServer((socket) => {
          if (socket.remoteAddress !== lanIp) {
            socket.destroy();
            return;
          }
          const upstream = connect(Number(new URL(app.base).port), "127.0.0.1");
          for (const s of [upstream, socket]) {
            sockets.add(s);
            s.on("error", () => s.destroy());
            s.on("close", () => {
              sockets.delete(s);
              (s === socket ? upstream : socket).destroy();
            });
          }
          socket.pipe(upstream).pipe(socket);
        });
        try {
          relay.listen(0, lanIp);
          await once(relay, "listening");
          const address = relay.address();
          assert(address && typeof address !== "string");
          const lanBase = "http://" + lanIp + ":" + address.port,
            lanPage = await browser.newPage();
          await lanPage.goto(lanBase);
          await signIn(lanPage, "admin@fixture.invalid");
          await lanPage.goto(lanBase + "/admin/activity");
          const lan = await imageBrowser(
            lanPage,
            lanBase,
            join(directory, "attachment-lan.png"),
            true,
          );
          logoPath = lan.logoUrl;
          return { ...result, insecureLanCopy: true, lanWidget: true };
        } finally {
          for (const socket of sockets) socket.destroy();
          await new Promise<void>((yes) => relay.close(() => yes()));
        }
      } finally {
        await browser.close();
      }
    });
    await check("images/public-cache-exif-and-authorization", async () => {
      const posted = await sendImage(app.base, exifJpeg);
      assert.equal(posted.status, 201);
      const { id, url } = await posted.json();
      const result = await fetch(app.base + url);
      assert.equal(result.headers.get("content-type"), "image/jpeg");
      assert.equal(result.headers.get("etag"), '"' + id + '"');
      assert.equal(result.headers.get("x-content-type-options"), "nosniff");
      assert.match(
        result.headers.get("content-security-policy") ?? "",
        /default-src 'none'; sandbox/,
      );
      assert.equal(result.headers.get("content-disposition"), "inline");
      assert.equal(
        result.headers.get("cache-control"),
        "public, max-age=86400",
      );
      assert.deepEqual(Buffer.from(await result.arrayBuffer()), exifJpeg);
      assert.equal(
        (
          await fetch(app.base + url, {
            headers: { "if-none-match": 'W/"' + id + '"' },
          })
        ).status,
        304,
      );
      assert.equal(
        (
          await fetch(app.base + "/api/images/" + randomUUID(), {
            headers: { "if-none-match": "*" },
          })
        ).status,
        404,
      );
      const svg = new FormData();
      svg.append(
        "file",
        new Blob(["<svg/>"], { type: "image/png" }),
        "image.png",
      );
      assert.equal(
        (await fetch(app.base + "/api/images", { method: "POST", body: svg }))
          .status,
        415,
      );
      for (const src of [
        "data:image/png;base64,AA==",
        "blob:unfinished",
        "/api/images/" + randomUUID(),
      ]) {
        const bad = await fetch(app.base + "/api/feedback/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            description: '<p>x<img src="' + src + '"></p>',
          }),
        });
        assert.equal(bad.status, 400);
        assert.equal(bad.headers.get("access-control-allow-origin"), "*");
      }
      assert.equal(
        (
          await fetch(app.base + "/api/trpc/reclaimPendingImages", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ json: { confirm: true } }),
          })
        ).status,
        401,
      );
      return {
        exifSha256: createHash("sha256").update(exifJpeg).digest("hex"),
        anonymousReclaim: "refused",
      };
    });
    await check("images/production-streams-rss-and-slot-recovery", () =>
      streamContracts(app.base, app.name, docker),
    );
    await check("images/attach-logo-delete-reclaim-sweep", async () =>
      JSON.parse(await worker("postgres", "contracts")),
    );
    await check("images/two-replica-quota", async () => {
      const before = await snapshot(pool);
      assert.equal(before.counts.images, before.images.length);
      // All current rows are attached after the storage contract's reclaim.
      const bytes = Number(
          (await pool.query('select sum("byteSize") as n from images')).rows[0]
            .n,
        ),
        size = samples.png.length;
      const env = [
        "MAX_PENDING_IMAGE_BYTES=" + size,
        "MAX_IMAGE_STORAGE_BYTES=" + (bytes + 2 * size),
      ];
      const [a, b] = await Promise.all([
        startApp("qa", "postgres", env),
        startApp("qb", "postgres", env),
      ]);
      const race = async () => {
        const replies = await Promise.all([
          sendImage(a.base),
          sendImage(b.base),
        ]);
        assert.deepEqual(replies.map((r) => r.status).sort(), [201, 507]);
        return (await replies.find((r) => r.status === 201)!.json())
          .url as string;
      };
      const attach = async (path: string) => {
        const r = await fetch(a.base + "/api/feedback/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ description: '<img src="' + path + '">' }),
        });
        assert.equal(r.status, 201);
        return (await r.json()).id as string;
      };
      const first = await race();
      await attach(first);
      const second = await race();
      assert.equal((await sendImage(a.base)).status, 507);
      await attach(second);
      assert.equal((await sendImage(b.base)).status, 507);
      assert.equal(
        Number(
          (await pool.query('select sum("byteSize") as n from images')).rows[0]
            .n,
        ),
        bytes + 2 * size,
      );
      await worker("postgres", "detach", { MAX_PENDING_IMAGE_BYTES: "0" });
      await Promise.all([docker("stop", a.name), docker("stop", b.name)]);
      return { concurrentReplicas: 2, rejectedPendingAndTotal: true };
    });
    const orphan = await sendImage(app.base);
    assert.equal(orphan.status, 201);
    const orphanId = (await orphan.json()).id;
    await docker("stop", app.name);
    await pool.query(
      "update images set \"createdAt\"=now()-interval '25 hours' where id=any($1::uuid[])",
      [[orphanId, imagePath.split("/").at(-1), logoPath.split("/").at(-1)]],
    );
    const expected = await snapshot(pool);
    assert(
      expected.refs.length >= 3 && expected.logo && expected.images.length >= 4,
    );
    await docker(
      "exec",
      database,
      "sh",
      "-ec",
      'umask 077; pg_dump -U postgres -Fc -Z 6 -f /private/board.dump postgres; test "$(stat -c %a /private/board.dump)" = 600',
    );
    for (const target of ["same_schema", "relocated"]) {
      await check("backup/restore-" + target, async () => {
        await docker("exec", database, "createdb", "-U", "postgres", target);
        const restored = poolFor(target);
        if (target === "relocated")
          await restored.query(
            "create schema extensions; create extension vector with schema extensions; alter extension vector set schema public",
          );
        await docker(
          "exec",
          database,
          "pg_restore",
          "-U",
          "postgres",
          "--no-owner",
          "--no-privileges",
          "--no-comments",
          "--single-transaction",
          "--exit-on-error",
          "-d",
          target,
          "/private/board.dump",
        );
        const actual = await snapshot(restored);
        assert.deepEqual(actual, expected);
        await worker(target, "sweep");
        const survivor = (
          await restored.query("select id from images order by id")
        ).rows.map((r) => r.id);
        assert.deepEqual(
          survivor,
          expected.images.map((r) => r.id).filter((id) => id !== orphanId),
        );
        const restoredApp = await startApp("restore-" + target, target);
        const login = await fetch(
          restoredApp.base + "/api/auth/sign-in/email",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: restoredApp.base,
            },
            body: JSON.stringify({
              email: "admin@fixture.invalid",
              password: fixturePassword,
            }),
          },
        );
        assert.equal(login.status, 200);
        assert.match(login.headers.get("set-cookie") ?? "", /session_token=/);
        for (const path of [logoPath, imagePath]) {
          const r = await fetch(restoredApp.base + path);
          assert.equal(r.status, 200);
          const hash = createHash("sha256")
            .update(Buffer.from(await r.arrayBuffer()))
            .digest("hex");
          assert.equal(
            hash,
            expected.images.find((i) => i.id === path.split("/").at(-1))!.hash,
          );
        }
        return {
          tables: Object.keys(actual.counts).length,
          images: actual.images.length,
          references: actual.refs.length,
          hashesMatched: true,
          originalPassword: true,
          onlyExpiredOrphanSwept: true,
        };
      });
    }
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    await Promise.all(pools.map((p) => p.end()));
    const results = await Promise.allSettled(
      containers.map((name) => docker("rm", "-f", "--volumes", name)),
    );
    if (network)
      results.push(
        ...(await Promise.allSettled([docker("network", "rm", project)])),
      );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length)
      throw new AggregateError(
        [...(primary ? [primary] : []), ...failed.map((r) => r.reason)],
        "Attachment fixture cleanup failed",
      );
  }
}
