import assert from "node:assert/strict";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { command, eventually } from "./run";

const pgImage =
  "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11";
export async function aiFoundations(runId: string) {
  assert.match(runId, /^p07-\d+-[a-f0-9]+$/);
  const project = runId + "-ai",
    pg = project + "-pg",
    worker = project + "-worker",
    certs = project + "-certs";
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
    const mounts = ["lib", "db", "queries", "scripts", "tsconfig.json"].flatMap(
      (p) => [
        "--mount",
        "type=bind,src=" + resolve(p) + ",dst=/app/" + p + ",readonly",
      ],
    );
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
      output.split('"event":"ai.stored-key-unreadable"').length - 1,
      1,
    );
    const summary = output
      .split(/\r?\n/)
      .find((line) => line.startsWith("P07_OUTCOME="));
    assert(summary, "Missing AI contracts result");
    return JSON.parse(summary.slice("P07_OUTCOME=".length));
  } finally {
    await Promise.all(
      [worker, pg].map((n) => docker("rm", "-fv", n).catch(() => {})),
    );
    await docker("volume", "rm", certs);
    await docker("network", "rm", project);
  }
}
