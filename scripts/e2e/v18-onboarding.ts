import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  randomBytes,
  randomUUID,
  createHash,
  createPublicKey,
} from "node:crypto";
import { command, eventually } from "./run";

const pgImage =
  "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11";
export async function verifyOnboarding(
  production: string,
  contractsOnly = false,
) {
  const id = "p11-" + randomUUID().slice(0, 8),
    pg = id + "-pg",
    certs = id + "-certs",
    ingress = id + "-in",
    worker = id + "-worker",
    provider = id + "-provider",
    relay = id + "-relay",
    web = id + "-web",
    peer = id + "-peer";
  const docker = (...args: string[]) =>
    command("docker", args, { timeout: 240000 });
  const image = (
    await docker("build", "--quiet", "--target", "dependencies", ".")
  )
    .split(/\r?\n/)
    .at(-1)!;
  assert.match(image, /^sha256:[a-f0-9]{64}$/);
  const mounts = [
    "lib",
    "db",
    "queries",
    "scripts",
    "app",
    "trpc",
    "tsconfig.json",
  ].flatMap((p) => [
    "--mount",
    "type=bind,src=" + resolve(p) + ",dst=/app/" + p + ",readonly",
  ]);
  const password = randomBytes(24).toString("hex"),
    setup = randomBytes(32).toString("hex");
  const database = (name: string) =>
    "DATABASE_URL=postgres://postgres:" + password + "@database:5432/" + name;
  const create = (name: string) =>
    docker("exec", pg, "createdb", "-U", "postgres", name);
  const sql = (statement: string) =>
    docker(
      "exec",
      pg,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "board_browser",
      "-Atqc",
      statement,
    );
  await docker("network", "create", "--internal", id);
  try {
    await docker("volume", "create", certs);
    await docker(
      "run",
      "-d",
      "--name",
      pg,
      "--network",
      id,
      "--network-alias",
      "database",
      "--tmpfs",
      "/var/lib/postgresql",
      "-v",
      certs + ":/certs",
      "-e",
      "POSTGRES_PASSWORD=" + password,
      pgImage,
    );
    await eventually(
      () => docker("exec", pg, "pg_isready", "-h", "127.0.0.1"),
      (s) => s.includes("accepting connections"),
    );
    await docker(
      "exec",
      pg,
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
      "subjectAltName=DNS:openrouter.ai,DNS:board.test,DNS:localhost,IP:127.0.0.1",
    );
    await create("board_contracts");
    const cert = [
      "-v",
      certs + ":/certs:ro",
      "-e",
      "NODE_EXTRA_CA_CERTS=/certs/provider.crt",
    ];
    const contracts = await docker(
      "run",
      "--rm",
      "--name",
      worker,
      "--network",
      id,
      "--add-host",
      "openrouter.ai:127.0.0.1",
      ...cert,
      ...mounts,
      "-e",
      "NODE_ENV=test",
      "-e",
      database("board_contracts"),
      image,
      "node",
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/e2e/onboarding-contracts.ts",
    );
    assert(contracts.includes("P11 onboarding contracts passed"));
    assert(
      !contracts.includes("P07_PRIVATE_") &&
        !contracts.includes("sk-or-v1-") &&
        !contracts.includes(password),
    );
    if (contractsOnly) return { contracts: "passed" };
    await create("board_browser");
    // This database exists only for this browser run. A live, adjustable wall clock lets the
    // same mounted documents and their actual SQL admissions cross UTC midnight together.
    await sql(`create schema onboarding_clock;
      create table onboarding_clock.settings(delta interval not null);
      insert into onboarding_clock.settings values(interval '0 seconds');
      create function onboarding_clock.clock_timestamp() returns timestamptz volatile language sql as
        'select pg_catalog.clock_timestamp()+delta from onboarding_clock.settings';
      alter database board_browser set search_path to public,onboarding_clock,pg_catalog`);

    await docker(
      "run",
      "-d",
      "--name",
      provider,
      "--network",
      id,
      "--network-alias",
      "openrouter.ai",
      ...cert,
      ...mounts,
      image,
      "node",
      "--import",
      "tsx",
      "scripts/e2e/onboarding-provider.ts",
      "--serve",
    );
    await eventually(
      () => docker("logs", provider),
      (s) => s.includes("Onboarding fixture listening"),
    );
    await docker("network", "create", ingress);
    await docker(
      "run",
      "-d",
      "--name",
      relay,
      "--network",
      ingress,
      ...[3000, 3001, 3443].flatMap((p) => ["-p", "127.0.0.1::" + p]),
      ...cert,
      ...mounts,
      image,
      "node",
      "scripts/e2e/onboarding-relay.mjs",
    );
    await docker("network", "connect", id, relay);
    const port = async (n: number) => {
      const match = (await docker("port", relay, n + "/tcp")).match(
        /^127\.0\.0\.1:(\d+)$/,
      );
      assert(match);
      return match[1];
    };
    const [secure, lan, auth] = await Promise.all([
      port(3000),
      port(3001),
      port(3443),
    ]);
    for (const [name, alias] of [
      [web, "board"],
      [peer, "public-board"],
    ]) {
      await docker(
        "run",
        "-d",
        "--name",
        name,
        "--network",
        id,
        "--network-alias",
        alias,
        ...cert,
        "-e",
        "SETUP_CODE=" + setup,
        "-e",
        database("board_browser"),
        ...(name === peer
          ? ["-e", "APP_URL=https://board.test:" + secure]
          : []),
        production,
      );
      await eventually(
        () =>
          docker(
            "exec",
            name,
            "node",
            "-e",
            "fetch('http://127.0.0.1:3000/api/health').then(r=>console.log(r.status))",
          ),
        (s) => s === "200",
      );
    }
    await sql(`create table onboarding_clock.poll(at timestamptz not null, key text not null);
      create function onboarding_clock.record_poll() returns trigger language plpgsql as $body$
        begin insert into onboarding_clock.poll values(new."windowStart",new.key);return null;end $body$;
      create trigger record_poll after insert or update on rate_limit for each row when (new.key like 'ai:credit-poll:%') execute function onboarding_clock.record_poll()`);
    const fixtureControl = async (path: string) => {
      const raw = await docker(
        "exec",
        provider,
        "node",
        "-e",
        "fetch('http://127.0.0.1:8089'+process.argv[1],{method:'POST'}).then(r=>r.text()).then(console.log)",
        path,
      );
      return JSON.parse(raw) as {
        mode: string;
        samples: { at: number; kind: string; images: number }[];
      };
    };
    const { onboardingBrowser } = await import("./onboarding-browser");
    const certPem = await docker("exec", pg, "cat", "/certs/provider.crt");
    const certificatePin = createHash("sha256")
      .update(createPublicKey(certPem).export({ type: "spki", format: "der" }))
      .digest("base64");
    const observations = await onboardingBrowser({
      certificatePin,
      secure,
      lan,
      auth,
      setup,
      sql,
      control: fixtureControl,
      setCredit: async (available) => {
        await fixtureControl("/mode?value=" + (available ? "paid" : "credit"));
      },
    });
    const logs = await Promise.all(
      [web, peer, provider].map((n) => docker("logs", n)),
    );
    assert(
      logs.every(
        (s) =>
          !s.includes("sk-or-v1-") &&
          !s.includes("P07_PRIVATE_") &&
          !s.includes(password),
      ),
    );
    return {
      contracts: "passed",
      replicas: 2,
      observations,
      origins: [
        "HTTPS localhost",
        "configured HTTPS public board",
        "private HTTP address",
      ],
      browser:
        "PKCE redirect and headless, credit, status and mounted visitor actions",
    };
  } finally {
    await Promise.all(
      [worker, provider, relay, web, peer, pg].map((n) =>
        docker("rm", "-fv", n).catch(() => {}),
      ),
    );
    await docker("network", "rm", ingress).catch(() => {});
    await docker("volume", "rm", certs);
    await docker("network", "rm", id);
  }
}
if (process.argv.includes("--standalone"))
  void verifyOnboarding(
    process.argv.at(-1)!,
    process.argv.includes("--contracts-only"),
  )
    .then((result) => console.log(JSON.stringify(result)))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
