import assert from "node:assert/strict";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { command, eventually } from "./run";
import { firstKey } from "../mock-llm";
import { contentBrowser } from "./content-ai-browser";

const pgImage =
  "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11";
export async function aiFoundations(runId: string, productionImage: string) {
  assert.match(runId, /^p07-\d+-[a-f0-9]+$/);
  const project = runId + "-ai",
    pg = project + "-pg",
    worker = project + "-worker",
    certs = project + "-certs",
    provider = project + "-provider",
    web = project + "-web",
    relay = project + "-relay",
    ingress = project + "-ingress";
  const docker = (...args: string[]) =>
    command("docker", args, { timeout: 240000 });
  const image = (
    await docker("build", "--quiet", "--target", "dependencies", ".")
  )
    .split(/\r?\n/)
    .at(-1)!;
  assert.match(image, /^sha256:[a-f0-9]{64}$/);
  const password = randomBytes(24).toString("hex");
  await docker("network", "create", "--internal", project);
  try {
    await docker("volume", "create", certs);
    await docker(
      "run",
      "-d",
      "--name",
      pg,
      "--network",
      project,
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
    await docker("exec", pg, "createdb", "-U", "postgres", "board_boot");
    // The production entry point must keep the whole board available when
    // optional AI configuration is invalid, even without a provider key.
    for (const setting of [
      "OPENROUTER_PRIVACY=typo",
      "AI_TIMEOUT_MS=invalid",
    ]) {
      try {
        await docker(
          "run",
          "-d",
          "--name",
          worker,
          "--network",
          project,
          "-e",
          "DATABASE_URL=postgres://postgres:" +
            password +
            "@database:5432/board_boot",
          "-e",
          "APP_URL=http://localhost:3000",
          "-e",
          setting,
          productionImage,
        );
        await eventually(
          () =>
            docker(
              "exec",
              worker,
              "node",
              "-e",
              "Promise.all(['/api/health','/','/setup'].map(async p=>(await fetch('http://127.0.0.1:3000'+p)).status)).then(s=>console.log(s.join(',')))",
            ),
          (status) => status === "200,200,200",
        );
        assert(
          (await docker("logs", worker)).includes(
            '"stage":"invalid-configuration"',
          ),
        );
      } finally {
        await docker("rm", "-f", worker).catch(() => {});
      }
    }
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
      "subjectAltName=DNS:openrouter.ai",
    );
    // Real DNS, TLS, global fetch and SDK serialization. The internal bridge has
    // no Internet route. The certificate and hostname override exist only here.
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
    let output: string;
    try {
      output = await docker(
        "run",
        "--rm",
        "--name",
        worker,
        "--network",
        project,
        "--add-host",
        "openrouter.ai:127.0.0.1",
        "--memory",
        "512m",
        "--memory-swap",
        "512m",
        "-v",
        certs + ":/certs:ro",
        ...mounts,
        "-e",
        "NODE_EXTRA_CA_CERTS=/certs/provider.crt",
        "-e",
        "NODE_ENV=test",
        "-e",
        "DATABASE_URL=postgres://postgres:" +
          password +
          "@database:5432/postgres",
        "-e",
        "APP_URL=http://localhost:3000",
        "-e",
        "AI_EMBEDDING_DIMENSIONS=3",
        image,
        "node",
        "--conditions=react-server",
        "--import",
        "tsx",
        "scripts/e2e/ai-foundation-contracts.ts",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("P07_PRIVATE_") || message.includes(password))
        throw new Error("P07 private marker in worker output");
      throw error;
    }
    assert(
      !output.includes("P07_PRIVATE_") && !output.includes(password),
      "P07 private marker in worker output",
    );
    assert.equal(
      output
        .split("P08_CONTENT_CONTRACTS")[0]
        .split('"event":"ai.stored-key-unreadable"').length - 1,
      1,
    );
    assert(
      output.split(
        '"event":"ai.settlement-failed","name":"title","stage":"accounting"',
      ).length -
        1 >=
        4,
      "Each injected settlement failure must emit a safe accounting diagnostic",
    );
    const summary = output
      .split(/\r?\n/)
      .find((line) => line.startsWith("P07_OUTCOME="));
    assert(summary, "Missing AI contracts result");
    await docker("exec", pg, "createdb", "-U", "postgres", "board_content");
    await docker(
      "run",
      "-d",
      "--name",
      provider,
      "--network",
      project,
      "--network-alias",
      "openrouter.ai",
      "-v",
      certs + ":/certs:ro",
      ...mounts,
      image,
      "node",
      "--import",
      "tsx",
      "scripts/e2e/content-ai-provider.ts",
    );
    await eventually(
      () => docker("logs", provider),
      (s) => s.includes("Content fixture ready"),
    );
    const setup = randomBytes(32).toString("hex");
    await docker(
      "run",
      "-d",
      "--name",
      web,
      "--network",
      project,
      "--network-alias",
      "board",
      "-v",
      certs + ":/certs:ro",
      "-e",
      "NODE_EXTRA_CA_CERTS=/certs/provider.crt",
      "-e",
      "OPENROUTER_API_KEY=" + firstKey,
      "-e",
      "SETUP_CODE=" + setup,
      "-e",
      "DATABASE_URL=postgres://postgres:" +
        password +
        "@database:5432/board_content",
      productionImage,
    );
    // The browser reaches only the board port through this TCP relay. The board,
    // fixture and database remain on a private network without an Internet route.
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
      "const net=require('node:net');net.createServer(client=>{const board=net.connect(3000,'board');board.on('error',()=>client.destroy());client.on('error',()=>board.destroy());client.pipe(board).pipe(client)}).listen(3000)",
    );
    await docker("network", "connect", project, relay);
    const port = (await docker("port", relay, "3000/tcp")).match(
      /^127\.0\.0\.1:(\d+)$/,
    )?.[1];
    assert(port, "Missing loopback board port");
    const base = "http://localhost:" + port;
    await eventually(
      () => fetch(base + "/api/health").then((r) => r.status),
      (s) => s === 200,
    );
    const browserResult = await contentBrowser(base, setup);
    const logs = await docker("logs", web);
    assert(
      !logs.includes("P07_PRIVATE_") &&
        !logs.includes(password) &&
        !logs.includes(setup),
      "Private marker in production logs",
    );
    return {
      browser: browserResult,
      ...JSON.parse(summary.slice("P07_OUTCOME=".length)),
      invalidAiEnvironmentBoot: "privacy and timeout passed",
    };
  } finally {
    await Promise.all(
      [worker, relay, web, provider, pg].map((n) =>
        docker("rm", "-fv", n).catch(() => {}),
      ),
    );
    await docker("network", "rm", ingress).catch(() => {});
    await docker("volume", "rm", certs);
    await docker("network", "rm", project);
  }
}
