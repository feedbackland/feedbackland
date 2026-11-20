import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, request } from "node:http";
import { once } from "node:events";
import { networkInterfaces, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { z } from "zod";
import { primaryJourney, keylessAiEndpoints } from "./v2-primary";
import { submitSetup } from "./setup-browser";
import { cleanupNetworkFixture } from "./v16-egress";
import { command, eventually, toolEnvironment } from "./run";
import { firstKey } from "../mock-llm";
import { releaseFixtures } from "../ai-release-fixtures";
import { validCosineVector } from "../../lib/vector-values";
import { calibrationWidth } from "../ai-calibration-search";
import { defaults } from "../../lib/llm/defaults";

const pgImage =
  "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11";
const privateIpv4 = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const docker = (...args: string[]) =>
  command("docker", args, { timeout: 180_000 });

const vector = z
  .array(z.number())
  .length(calibrationWidth)
  .refine((v) => validCosineVector(v, calibrationWidth));
const savedPairs = z.object({
  status: z.literal("measured"),
  fixtureManifest: z.object({
    hashes: z.object({ search: z.string().length(64) }),
  }),
  result: z.object({
    embeddingModel: z.literal(defaults.embeddingModel),
    embeddingWidth: z.literal(calibrationWidth),
    search: z.object({ searchMaxDistance: z.number().min(0).max(2) }),
    searchVectors: z
      .array(
        z.object({
          id: z.string(),
          expected: z.enum(["related", "unrelated"]),
          query: vector,
          document: vector,
        }),
      )
      .length(20),
  }),
});

async function searchCalibration(path?: string) {
  const fixtures = await releaseFixtures();
  const baseline = [
    Array.from({ length: calibrationWidth }, (_, i) => (i === 0 ? 1 : 0)),
    Array.from({ length: calibrationWidth }, (_, i) => (i === 1 ? 1 : 0)),
  ];
  const result = path
    ? savedPairs.parse(JSON.parse(await readFile(path, "utf8")))
    : {
        status: "measured",
        fixtureManifest: { hashes: { search: fixtures.hashes.search } },
        result: {
          search: { searchMaxDistance: 0.5 },
          searchVectors: fixtures.search.map(({ id, expected }) => ({
            id,
            expected,
            query: baseline[0],
            document: baseline[expected === "related" ? 0 : 1],
          })),
        },
      };
  assert.equal(result.fixtureManifest.hashes.search, fixtures.hashes.search);
  return {
    cutoff: result.result.search.searchMaxDistance,
    pairs: fixtures.search.map((pair, i) => {
      const actual = result.result.searchVectors[i];
      assert.equal(actual.id, pair.id);
      assert.equal(actual.expected, pair.expected);
      return { ...pair, queryVector: actual.query, document: actual.document };
    }),
  };
}

async function procedure<T>(
  page: Page,
  base: string,
  name: string,
  input?: unknown,
): Promise<T> {
  const response = await page.request.post(base + "/api/trpc/" + name, {
    headers: { origin: base },
    data: input === undefined ? {} : { json: input },
  });
  assert.equal(response.status(), 200, name);
  return (await response.json()).result.data.json;
}

async function exerciseCalibratedSearch(
  page: Page,
  base: string,
  sql: (statement: string) => Promise<string>,
  entries: Awaited<ReturnType<typeof searchCalibration>>["pairs"],
) {
  const ids: string[] = [];
  for (const pair of entries) {
    ids.push(
      await sql(
        'insert into feedback(title,description,"plainText","moderationState",embedding) values (' +
          [
            quote(pair.post),
            quote(pair.post),
            quote(pair.post),
            "'screened'",
            quote("[" + pair.document.join(",") + "]") + "::vector",
          ].join(",") +
          ") returning id",
      ),
    );
  }
  for (const surface of ["getFeedbackPosts", "getActivityFeed"]) {
    // Run each surface in its own quota window on the disposable board.
    await sql(
      "update rate_limit set \"windowStart\"=clock_timestamp()-interval '61 seconds' where key like 'search-embedding:%' or key like 'search-text:%'",
    );
    for (const [i, pair] of entries.entries()) {
      const capability = await procedure<string>(
        page,
        base,
        "issueSearchTicket",
        {
          nonce: randomBytes(32).toString("hex"),
        },
      );
      const state = await procedure<{
        search: { mode: string };
        feedbackPosts?: { id: string }[];
        items?: { id: string }[];
      }>(page, base, surface, {
        searchValue: pair.query,
        capability,
        status: null,
        orderBy: "newest",
        ...(surface === "getFeedbackPosts"
          ? { limit: 100 }
          : {
              pageSize: 100,
              categories: null,
              excludeComments: true,
              excludeFeedback: false,
              unseenOnly: false,
            }),
      });
      assert.equal(state.search.mode, "semantic", pair.id + " " + surface);
      assert.equal(
        (state.items ?? state.feedbackPosts)!.some((row) => row.id === ids[i]),
        pair.expected === "related",
        pair.id + " " + surface,
      );
    }
  }
  return { pairs: entries.length, surfaces: 2 };
}

function lanRelay(port: number) {
  const addresses = Object.values(networkInterfaces()).flat();
  const list = addresses.filter(
    (entry) => entry?.family === "IPv4" && privateIpv4.test(entry.address),
  );
  const lan =
    list.find((entry) => entry!.address.startsWith("192.168."))?.address ??
    list[0]?.address;
  assert(
    lan,
    "A private IPv4 interface is required for the HTTP LAN browser leg",
  );
  const server = createServer((incoming, response) => {
    const forwarded = request(
      {
        hostname: "127.0.0.1",
        port,
        method: incoming.method,
        path: incoming.url,
        headers: incoming.headers,
      },
      (upstream) => {
        response.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(response);
      },
    );
    forwarded.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    incoming.on("aborted", () => forwarded.destroy());
    response.on("close", () => forwarded.destroy());
    incoming.pipe(forwarded);
  });
  server.listen(0, lan);
  return { server, lan };
}

export async function verifyPrimaryCompose(image: string, report?: string) {
  const calibration = await searchCalibration(report);
  const providerImage = (
    await docker("build", "--quiet", "--target", "dependencies", ".")
  )
    .split(/\r?\n/)
    .at(-1)!;
  assert.match(providerImage, /^sha256:[a-f0-9]{64}$/);
  const browser = await chromium.launch({
    env: toolEnvironment() as Record<string, string>,
  });
  const passes = [];
  try {
    for (const mode of ["exact", "semantic"] as const) {
      passes.push(
        await runCompose(browser, image, providerImage, mode, calibration),
      );
    }
  } finally {
    await browser.close();
  }
  return {
    source: report ? "measured fixture vectors" : "offline synthetic vectors",
    passes,
  };
}

async function runCompose(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  image: string,
  providerImage: string,
  mode: "exact" | "semantic",
  calibration: Awaited<ReturnType<typeof searchCalibration>>,
) {
  const project = "p12-compose-" + randomUUID().slice(0, 10);
  const directory = await mkdtemp(join(tmpdir(), project));
  const setup = randomBytes(32).toString("hex");
  const password = randomBytes(24).toString("hex");
  const env = {
    FEEDBACKLAND_IMAGE: image,
    POSTGRES_PASSWORD: password,
    P12_SETUP: setup,
    P12_MODEL: defaults.embeddingModel,
  };
  const compose = (...args: string[]) =>
    command(
      "docker",
      [
        "compose",
        "-p",
        project,
        "-f",
        join(directory, "compose.yml"),
        "-f",
        join(directory, "check.yml"),
        ...args,
      ],
      { env, timeout: 180_000 },
    );
  const sql = (statement: string) =>
    compose(
      "exec",
      "-T",
      "db",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "feedbackland",
      "-Atqc",
      statement,
    );
  const configured = mode === "semantic";
  const ingress = project + "-ingress";
  const relay = project + "-relay";
  let failure: unknown;
  try {
    await copyFile("compose.yml", join(directory, "compose.yml"));
    const bind = (source: string, target: string) =>
      "      - " +
      JSON.stringify(resolve(source) + ":" + target + ":ro") +
      "\n";
    const fixture = join(directory, "calibration.json");
    if (configured) {
      await writeFile(
        fixture,
        JSON.stringify(
          calibration.pairs.map((pair) => ({
            text: pair.query,
            query: pair.queryVector,
          })),
        ),
      );
      await docker(
        "run",
        "--rm",
        "--pull=never",
        "--network",
        "none",
        "-v",
        directory + ":/certs",
        pgImage,
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        "/certs/provider.key",
        "-out",
        "/certs/provider.crt",
        "-days",
        "1",
        "-subj",
        "/CN=openrouter.ai",
        "-addext",
        "subjectAltName=DNS:openrouter.ai",
      );
    }
    const override =
      "services:\n  db:\n    image: " +
      pgImage +
      "\n  app:\n    ports: !reset []\n    environment:\n      SETUP_CODE: \${P12_SETUP}\n" +
      (configured
        ? "      OPENROUTER_API_KEY: " +
          firstKey +
          "\n" +
          "      OPENROUTER_EMBEDDING_MODEL: \${P12_MODEL}\n" +
          "      AI_SEARCH_MAX_DISTANCE: " +
          JSON.stringify(String(calibration.cutoff)) +
          "\n" +
          "      NODE_EXTRA_CA_CERTS: /certs/provider.crt\n    volumes:\n" +
          bind(join(directory, "provider.crt"), "/certs/provider.crt") +
          "  mock:\n    image: " +
          providerImage +
          "\n    command: [node, --import, tsx, scripts/e2e/content-ai-provider.ts]\n" +
          "    environment:\n      P12_FIXTURE_WIDTH: '384'\n      P12_CALIBRATION_FIXTURE: '1'\n" +
          "    networks:\n      default:\n        aliases: [openrouter.ai]\n    volumes:\n" +
          bind("scripts", "/app/scripts") +
          bind("lib", "/app/lib") +
          bind(directory, "/certs") +
          bind(fixture, "/p12-calibration.json")
        : "") +
      "networks:\n  default:\n    internal: true\n";
    await writeFile(join(directory, "check.yml"), override);
    if (configured) {
      await compose("up", "-d", "--pull", "never", "mock");
      await eventually(
        () => compose("logs", "mock"),
        (log) => log.includes("Content fixture ready"),
      );
    }
    await compose("up", "-d", "--pull", "never", "app");
    await docker("network", "create", ingress);
    await docker(
      "run",
      "-d",
      "--name",
      relay,
      "--network",
      ingress,
      "-p",
      "127.0.0.1::3000",
      image,
      "node",
      "-e",
      "const n=require('node:net');n.createServer(c=>{const s=n.connect(3000,'app');s.on('error',()=>c.destroy());c.on('error',()=>s.destroy());s.on('close',()=>c.destroy());c.on('close',()=>s.destroy());c.pipe(s).pipe(c)}).listen(3000)",
    );
    await docker("network", "connect", project + "_default", relay);
    const origin = async () => {
      const port = Number(
        (await docker("port", relay, "3000/tcp")).match(
          /^127\.0\.0\.1:(\d+)$/,
        )?.[1],
      );
      assert(port);
      const base = "http://localhost:" + port;
      await eventually(
        () =>
          fetch(base + "/api/health", {
            signal: AbortSignal.timeout(2000),
          }).then((r) => r.status),
        (status) => status === 200,
        60_000,
      );
      assert.equal(
        await docker(
          "inspect",
          "--format",
          "{{.Image}}",
          await compose("ps", "-q", "app"),
        ),
        image,
      );
      return { base, port };
    };
    let endpoint = await origin();
    const page = await browser.newPage();
    try {
      await submitSetup(page, endpoint.base, setup);
      let indexEvidence;
      if (configured) {
        const reports = async () =>
          (await compose("logs", "app"))
            .split(/\r?\n/)
            .find(
              (line) =>
                line.includes('"event":"ai.embedding-width"') &&
                line.includes("384") &&
                line.includes("768"),
            );
        assert(await eventually(reports, Boolean));
        await page.goto(endpoint.base + "/admin/system");
        await page
          .getByText(/768 dimensions.*provider returned 384/)
          .first()
          .waitFor();
        const loss = await procedure<{ id: string; moderationState: string }>(
          page,
          endpoint.base,
          "createFeedbackPost",
          {
            description: "P12 width mismatch exact posting remains available",
          },
        );
        assert.equal(loss.moderationState, "screened");
        await searchMode(
          page,
          endpoint.base,
          "P12 width mismatch",
          "exact",
          loss.id,
        );
        await compose("kill", "-s", "SIGUSR1", "mock");
        await eventually(
          () => compose("logs", "mock"),
          (log) => log.includes("Fixture width released"),
        );
        await compose(
          "up",
          "-d",
          "--no-deps",
          "--force-recreate",
          "--pull",
          "never",
          "app",
        );
        endpoint = await origin();
        await page.goto(endpoint.base + "/admin/system");
        await page.getByText(/Semantic search is available/).waitFor();
        indexEvidence = {
          observed: 384,
          expected: 768,
          afterRestart: "verified",
        };
      } else {
        await keylessAiEndpoints(page, endpoint.base);
      }
      const local = await primaryJourney(page, endpoint.base, mode, sql);
      const { server, lan } = lanRelay(endpoint.port);
      const runLan = async () => {
        try {
          await once(server, "listening");
          const address = server.address();
          assert(address && typeof address !== "string");
          return await primaryJourney(
            page,
            "http://" + lan + ":" + address.port,
            mode,
            sql,
            true,
          );
        } finally {
          server.closeAllConnections();
          await new Promise<void>((done, reject) =>
            server.close((error) => (error ? reject(error) : done())),
          );
        }
      };
      const lanJourney = await runLan();
      if (!configured) return { local, lan: lanJourney };

      const search = await exerciseCalibratedSearch(
        page,
        endpoint.base,
        sql,
        calibration.pairs,
      );
      await compose("stop", "app");
      // A stopped cohort can rotate the environment after its last lease
      // expires. Wait for the actual lease to drain before the changed boot.
      await eventually(
        () =>
          sql(
            "select count(*) from job_lease where name like 'ai-config:%' and until>clock_timestamp()",
          ),
        (count) => count === "0",
        30000,
      );
      env.P12_MODEL = "openai/text-embedding-3-large";
      await compose(
        "up",
        "-d",
        "--no-deps",
        "--force-recreate",
        "--pull",
        "never",
        "app",
      );
      endpoint = await origin();
      await page.goto(endpoint.base + "/admin/system");
      await page
        .getByText(/^Rebuild the index to use the configured model or width\./)
        .first()
        .waitFor();
      await searchMode(page, endpoint.base, "P12 width mismatch", "exact");
      await page
        .getByRole("button", { name: "Rebuild search index", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm rebuild", exact: true })
        .click();
      await page
        .getByText("Index rebuild committed.", { exact: false })
        .waitFor();
      await page.getByText(/Semantic search is available/).waitFor();
      await searchMode(page, endpoint.base, "P12 width mismatch", "semantic");
      return {
        local,
        lan: lanJourney,
        indexEvidence,
        changedSameWidthModel: "recovered after rebuild",
        search,
      };
    } finally {
      await page.close();
    }
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try {
      await cleanupNetworkFixture([
        [[relay, () => docker("rm", "-fv", relay)]],
        [
          [project, () => compose("down", "--volumes", "--remove-orphans")],
          [ingress, () => docker("network", "rm", ingress)],
        ],
        [
          [
            "Compose fixture directory",
            async () => {
              assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
              await rm(directory, { recursive: true, force: true });
            },
          ],
        ],
      ]);
    } catch (cleanup) {
      if (failure)
        throw new AggregateError(
          [failure, cleanup],
          "Compose verification and cleanup both failed",
        );
      throw cleanup;
    }
  }
}

async function searchMode(
  page: Page,
  base: string,
  query: string,
  mode: string,
  postId?: string,
) {
  const capability = await procedure<string>(page, base, "issueSearchTicket", {
    nonce: randomBytes(32).toString("hex"),
  });
  const data = await procedure<{
    search: { mode: string };
    feedbackPosts: { id: string }[];
  }>(page, base, "getFeedbackPosts", {
    capability,
    searchValue: query,
    status: null,
    orderBy: "newest",
    limit: 20,
  });
  assert.equal(data.search.mode, mode);
  if (postId) assert(data.feedbackPosts.some(({ id }) => id === postId));
}

if (
  process.argv[1]?.endsWith("v2-compose-primary.ts") &&
  process.argv.includes("--standalone")
)
  void command("docker", [
    "image",
    "inspect",
    "--format",
    "{{.Id}}",
    process.argv.at(-1)!,
  ])
    .then((image) => verifyPrimaryCompose(image))
    .then((value) => console.log(JSON.stringify(value)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
