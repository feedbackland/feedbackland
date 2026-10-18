import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { command } from "./e2e/run";

export async function staticFoundations() {
  // Recompute, rather than trusting a stale file left by an earlier build.
  await command(process.execPath, ["scripts/build-identity.mjs"], {
    env: { SOURCE_COMMIT: process.env.SOURCE_COMMIT },
  });
  const checkout = await command("git", ["rev-parse", "HEAD"]);
  if (process.env.SOURCE_COMMIT)
    assert.equal(process.env.SOURCE_COMMIT, checkout);
  const dockerfile = await readFile("Dockerfile", "utf8");
  assert.match(
    dockerfile,
    /FROM node:24-trixie-slim@sha256:[a-f0-9]{64} AS build/,
  );
  assert.match(dockerfile, /ENV NEXT_TELEMETRY_DISABLED=1/);
  assert.match(dockerfile, /RUN --network=none npm run build/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /CMD \["node", "server.js"\]/);
  const layout = await readFile("app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /next\/font\/google/);
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.engines.node, ">=24 <25");
  assert.equal(pkg.license, "MIT");
  const identity = JSON.parse(
    await readFile("lib/build-identity.json", "utf8"),
  );
  assert.match(identity.artifactId, /^[a-f0-9]{64}$/);
  assert.match(identity.deploymentId, /^[a-f0-9]{32}$/);
  assert.equal(identity.deploymentId, identity.artifactId.slice(0, 32));
  const nextConfig = await import("../next.config");
  assert.equal(nextConfig.default.deploymentId, identity.deploymentId);
  assert.equal(
    await nextConfig.default.generateBuildId?.(),
    identity.artifactId,
  );
  await command(process.execPath, [
    "--import",
    "tsx",
    "scripts/e2e/import-boundaries.ts",
  ]);
  await command(process.execPath, [
    "--import",
    "tsx",
    "scripts/e2e/readiness-bounds.ts",
  ]);
  await command(process.execPath, [
    "--require",
    "./scripts/eslint-ts6-resolver.cjs",
    "./node_modules/eslint/bin/eslint.js",
    "app/api/health/route.ts",
    "app/layout.tsx",
    "db/db.ts",
    "lib/lazy-delegate.ts",
    "lib/firebase/admin.ts",
    "lib/firebase/client.ts",
    "lib/supabase.ts",
    "next.config.ts",
    "eslint.config.mjs",
    "scripts/build-identity.mjs",
    "scripts/ci-gates.ts",
    "scripts/verify.ts",
    "scripts/e2e/run.ts",
    "scripts/e2e/import-boundaries.ts",
    "scripts/e2e/readiness-bounds.ts",
    "scripts/e2e/v0-foundations.ts",
  ]);
  return {
    checkout,
    sourceTreeHash: identity.sourceTreeHash,
    artifactId: identity.artifactId,
    importBoundaries: "passed",
    readinessBounds: "passed",
    changedCodeLint: "passed",
  };
}
