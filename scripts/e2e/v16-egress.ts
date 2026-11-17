import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { command, eventually, toolEnvironment } from "./run";
import { submitSetup } from "./setup-browser";
import { keylessAiEndpoints, primaryJourney } from "./v2-primary";

const postgres =
  "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11";
const caddy =
  "caddy@sha256:e70b164da81ef698b3ad19af799ea6086ce6d9e48ed4079eb9fe26f6fbf14ee5";

type Endpoint = { call: string; host: string; port: number; count: number };
type Observed = { undecoded: number; endpoints: Endpoint[] };

async function removeFixtureDirectory(path: string) {
  assert.equal(dirname(resolve(path)), resolve(tmpdir()));
  await rm(path, { recursive: true, force: true });
}

export async function keylessEgress(image: string) {
  const run = "p12-net-" + randomUUID().slice(0, 8);
  const network = run + "-private",
    ingress = run + "-ingress",
    observer = run + "-tools",
    database = run + "-db",
    resolver = run + "-dns",
    proxy = run + "-proxy",
    app = run + "-app",
    control = run + "-control";
  const docker = (...args: string[]) =>
    command("docker", args, { timeout: 240_000 });
  const directory = await mkdtemp(join(tmpdir(), run));
  const password = randomBytes(24).toString("hex");
  const setup = randomBytes(32).toString("hex");
  const address = (name: string) =>
    docker(
      "inspect",
      "--format",
      "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
      name,
    );
  const bind = (src: string, dst: string) => [
    "--mount",
    "type=bind,src=" + resolve(src) + ",dst=" + dst + ",readonly",
  ];
  try {
    const tools = (
      await docker(
        "build",
        "--quiet",
        "-f",
        "ci/network-observer.Dockerfile",
        ".",
      )
    )
      .split(/\r?\n/)
      .at(-1)!;
    assert.match(tools, /^sha256:[a-f0-9]{64}$/);
    await docker("network", "create", "--internal", network);
    await docker("network", "create", ingress);
    await docker("volume", "create", observer);
    await docker(
      "run",
      "--rm",
      "--network",
      "none",
      "-v",
      observer + ":/tools",
      tools,
      "cp",
      "-a",
      "/observer/.",
      "/tools/",
    );
    await docker(
      "run",
      "-d",
      "--name",
      database,
      "--network",
      network,
      "--tmpfs",
      "/var/lib/postgresql",
      "-e",
      "POSTGRES_PASSWORD=" + password,
      postgres,
    );
    await eventually(
      () => docker("exec", database, "pg_isready", "-h", "127.0.0.1"),
      (status) => status.includes("accepting connections"),
    );
    const dbAddress = await address(database);
    await docker(
      "run",
      "-d",
      "--name",
      resolver,
      "--network",
      network,
      tools,
      "dnsmasq",
      "--keep-in-foreground",
      "--no-resolv",
      "--no-hosts",
      "--log-queries",
      "--log-facility=-",
      "--host-record=db," + dbAddress,
    );
    const dnsAddress = await address(resolver);
    const resolv = join(directory, "resolv.conf");
    await writeFile(
      resolv,
      "nameserver " + dnsAddress + "\noptions timeout:1 attempts:1\n",
    );
    const traced = [
      "--network",
      network,
      "--cap-add",
      "SYS_PTRACE",
      "--tmpfs",
      "/trace:uid=1000,gid=1000,mode=0700,size=16m",
      "--mount",
      "type=volume,src=" + observer + ",dst=/observer,readonly",
      ...bind(resolv, "/etc/resolv.conf"),
      ...bind(
        "scripts/e2e/fixtures/network-attempts.mjs",
        "/network-attempts.mjs",
      ),
      "-e",
      "LD_LIBRARY_PATH=/observer/lib",
      "--entrypoint",
      "/observer/strace",
    ];
    const trace = [
      "-ff",
      "-s",
      "0",
      "-e",
      "trace=network",
      "-o",
      "/trace/network",
      "--",
      "node",
    ];
    const read = async (container: string): Promise<Observed> =>
      JSON.parse(
        await docker(
          "exec",
          container,
          "node",
          "/network-attempts.mjs",
          "/trace",
        ),
      );
    const external = ({ undecoded, endpoints }: Observed) => {
      assert.equal(undecoded, 0, "network observer could not decode a syscall");
      return endpoints.filter(
        ({ host, port }) =>
          !(
            (host === dbAddress && port === 5432) ||
            (host === dnsAddress && port === 53) ||
            (host === "127.0.0.1" && [0, 3000].includes(port))
          ),
      );
    };

    await docker(
      "run",
      "-d",
      "--name",
      control,
      ...traced,
      ...bind(
        "scripts/e2e/fixtures/network-positive-control.mjs",
        "/control.mjs",
      ),
      image,
      ...trace,
      "--input-type=module",
      "-e",
      "await import('/control.mjs'); console.log('Control complete'); setInterval(() => {}, 10000)",
    );
    await eventually(
      () => docker("logs", control),
      (log) => log.includes("Control complete"),
      10_000,
    );
    const fromControl = external(await read(control));
    assert(
      fromControl.some(
        ({ call, host, port }) =>
          call === "connect" && host === "192.0.2.87" && port === 443,
      ),
      "observer must see the failed literal-IP connection",
    );
    const dnsQueries = async () =>
      Array.from(
        (await docker("logs", resolver)).matchAll(
          /\bquery\[[^\]]+\]\s+(\S+)\s+from\b/g,
        ),
        (m) => m[1],
      );
    const priorQueries = await dnsQueries();
    assert(
      priorQueries.includes("observer-control.invalid"),
      "resolver must see the reserved positive-control lookup",
    );
    await docker("rm", "-f", control);

    await docker(
      "run",
      "-d",
      "--name",
      app,
      "--network-alias",
      "board",
      ...traced,
      "-e",
      "DATABASE_URL=postgres://postgres:" + password + "@db:5432/postgres",
      "-e",
      "SETUP_CODE=" + setup,
      image,
      ...trace,
      "server.js",
    );
    assert.equal(
      await docker(
        "exec",
        app,
        "node",
        "-e",
        "console.log(Object.keys(process.env).filter(k => /^(OPENROUTER_|SMTP_|GOOGLE_|MICROSOFT_|OIDC_)/.test(k)).length)",
      ),
      "0",
    );
    assert.equal(
      await docker("inspect", "--format", "{{.Image}}", app),
      image,
      "observer must run the exact production image",
    );
    await docker(
      "run",
      "-d",
      "--name",
      proxy,
      "--network",
      ingress,
      "-p",
      "127.0.0.1::8080",
      caddy,
      "caddy",
      "reverse-proxy",
      "--from",
      ":8080",
      "--to",
      "board:3000",
    );
    await docker("network", "connect", network, proxy);
    const published = /^127\.0\.0\.1:(\d+)$/.exec(
      await docker("port", proxy, "8080/tcp"),
    );
    assert(published);
    const origin = "http://localhost:" + published[1];
    await eventually(
      async () =>
        (
          await fetch(origin + "/api/health", {
            signal: AbortSignal.timeout(2000),
          })
        ).status,
      (status) => status === 200,
    );
    let walkthrough: Awaited<ReturnType<typeof primaryJourney>>;
    let scopedAiEndpoints: number;
    const browser = await chromium.launch({
      env: toolEnvironment() as Record<string, string>,
    });
    try {
      const page = await browser.newPage();
      await submitSetup(page, origin, setup);
      await page
        .getByText("Let the board do the sorting", { exact: true })
        .waitFor();
      await page.goto(origin + "/admin/settings/ai");
      await page
        .getByRole("heading", { name: "AI off", exact: true })
        .waitFor();
      await page
        .getByText("Advanced settings and privacy", { exact: true })
        .click();
      await page
        .getByText("What is sent to OpenRouter", { exact: true })
        .click();
      await page.getByText(/unpublished draft text/).waitFor();
      await page.goto(origin + "/admin/ask-ai");
      await page.getByText(/Ask questions about your/).waitFor();
      const settings = await page.request.get(origin + "/api/settings");
      assert.equal(settings.status(), 200);
      const capabilities = (await settings.json()).capabilities;
      assert.equal(capabilities.chat, false);
      assert.equal(capabilities.embeddings, false);
      scopedAiEndpoints = await keylessAiEndpoints(page, origin);
      walkthrough = await primaryJourney(page, origin, "exact", (statement) =>
        docker(
          "exec",
          database,
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "postgres",
          "-Atqc",
          statement,
        ),
      );
      await page.waitForTimeout(6000);
    } finally {
      await browser.close();
    }
    const observed = await read(app);
    assert.deepEqual(external(observed), [], "unexpected outbound destination");
    assert(
      observed.endpoints.some(
        ({ host, port }) => host === dbAddress && port === 5432,
      ),
    );
    assert(
      observed.endpoints.some(
        ({ host, port }) => host === dnsAddress && port === 53,
      ),
    );
    const appQueries = (await dnsQueries()).slice(priorQueries.length);
    assert.deepEqual([...new Set(appQueries)], ["db"]);
    return {
      optionalEnvironment: "absent",
      walkthrough,
      scopedAiEndpoints,
      pages: ["setup", "Activity", "AI settings", "Ask AI"],
      resolverQueries: { db: appQueries.length, other: 0 },
      externalSocketAttempts: 0,
      databaseConnectAttempts: observed.endpoints
        .filter(
          ({ host, port, call }) =>
            host === dbAddress && port === 5432 && call === "connect",
        )
        .reduce((sum, { count }) => sum + count, 0),
      positiveControls: ["reserved DNS name", "failed TEST-NET-1 connect"],
    };
  } finally {
    await Promise.allSettled(
      [proxy, app, control, resolver, database].map((name) =>
        docker("rm", "-fv", name),
      ),
    );
    await Promise.allSettled([
      docker("volume", "rm", observer),
      docker("network", "rm", network),
      docker("network", "rm", ingress),
      removeFixtureDirectory(directory),
    ]);
  }
}

if (process.argv.includes("--standalone"))
  void command("docker", [
    "image",
    "inspect",
    "--format",
    "{{.Id}}",
    process.argv.at(-1)!,
  ])
    .then(keylessEgress)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
