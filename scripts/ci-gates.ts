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
    /FROM node:24-trixie-slim@sha256:[a-f0-9]{64} AS dependencies/,
  );
  assert.match(dockerfile, /FROM dependencies AS build/);
  assert.match(dockerfile, /ENV NEXT_TELEMETRY_DISABLED=1/);
  assert.match(dockerfile, /RUN --network=none npm run build/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /CMD \["node", "server.js"\]/);
  const layout = await readFile("app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /next\/font\/google/);
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.engines.node, ">=24 <25");
  assert.equal(pkg.license, "MIT");
  const dependencyLock = JSON.parse(
    await readFile("package-lock.json", "utf8"),
  ).packages;
  for (const [name, version] of Object.entries({
    ai: "7.0.99",
    "@ai-sdk/openai-compatible": "3.0.48",
    "js-tiktoken": "1.0.21",
  })) {
    assert.equal(pkg.dependencies[name], version);
    assert.equal(dependencyLock["node_modules/" + name].version, version);
  }
  assert.deepEqual(
    Object.keys(dependencyLock).filter((path) =>
      path.endsWith("node_modules/@ai-sdk/provider"),
    ),
    ["node_modules/@ai-sdk/provider"],
  );
  assert.equal(
    dependencyLock["node_modules/@ai-sdk/provider"].version,
    "4.0.14",
  );
  const identity = JSON.parse(
    await readFile("lib/build-identity.json", "utf8"),
  );
  assert.match(identity.artifactId, /^[a-f0-9]{64}$/);
  assert.match(identity.buildNonce, /^[a-f0-9]{32}$/);
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
  await command(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/e2e/readiness-bounds.ts",
    ],
    {
      env: {
        DATABASE_URL: "postgres://fixture:fixture-only@127.0.0.1:1/fixture",
      },
    },
  );
  await command(process.execPath, [
    "--import",
    "tsx",
    "scripts/e2e/runner-failures.ts",
  ]);
  await command(process.execPath, [
    "--import",
    "tsx",
    "scripts/e2e/build-identity.ts",
  ]);
  for (const script of [
    "client-contracts.tsx",
    "caller-inventory.ts",
    "auth-client.ts",
    "popup-client.ts",
  ])
    await command(process.execPath, [
      "--import",
      "tsx",
      `scripts/e2e/${script}`,
    ]);
  await command(process.execPath, [
    "--import",
    "tsx",
    "scripts/caller-inventory.ts",
    "docs/superpowers/reviews/2026-10-18-p02-caller-inventory.md",
    "--verify",
  ]);
  await command(process.execPath, [
    "--require",
    "./scripts/eslint-ts6-resolver.cjs",
    "./node_modules/eslint/bin/eslint.js",
    "app/api/health/route.ts",
    "app/layout.tsx",
    "db/db.ts",
    "lib/lazy-delegate.ts",
    "lib/auth/server.ts",
    "lib/auth/options.ts",
    "lib/auth/credentials.ts",
    "lib/auth/password-endpoints.ts",
    "lib/auth/discovery.ts",
    "lib/auth/oidc.ts",
    "lib/recovery.ts",
    "db/migrations/0002_password_recovery.ts",
    "db/migrations/0003_ai_dispatch.ts",
    "db/migrations/0004_moderation_coverage.ts",
    "db/content-transaction.ts",
    "lib/llm",
    "queries/content-write.ts",
    "queries/get-moderation-coverage.ts",
    "scripts/e2e/content-ai-contracts.ts",
    "scripts/e2e/content-ai-browser.ts",
    "scripts/e2e/content-ai-provider.ts",
    "scripts/e2e/content-regressions.ts",
    "scripts/e2e/content-editor-regressions.ts",
    "scripts/e2e/content-vision-http.ts",
    "lib/jobs/leases.ts",
    "lib/jobs/maintenance.ts",
    "lib/llm/embeddings.ts",
    "lib/llm/search-index.ts",
    "lib/search",
    "lib/vector-values.ts",
    "db/vector.ts",
    "trpc/issue-search-capability.ts",
    "queries/get-feedback-posts.ts",
    "queries/get-activity-feed.ts",
    "trpc/search-index.ts",
    "hooks/use-search-session.ts",
    "components/app/search-state.tsx",
    "scripts/e2e/durable-search.ts",
    "scripts/e2e/replica-search.ts",
    "scripts/e2e/search-browser-regressions.ts",
    "scripts/e2e/search-regressions.ts",
    "scripts/e2e/search-ticket.ts",
    "scripts/e2e/search-legacy.ts",
    "scripts/e2e/search-maintenance-worker.ts",
    "scripts/e2e/search-maintenance-regressions.ts",
    "scripts/e2e/keyless-content-http.mjs",
    "components/app/feedback-form/draft.ts",
    "scripts/e2e/ai-accounting-regressions.ts",
    "scripts/e2e/ai-configuration-regressions.ts",
    "scripts/e2e/ai-transport-regressions.ts",
    "lib/auth/client.ts",
    "lib/auth/popup-handoff.ts",
    "lib/auth/session-policy.ts",
    "lib/auth/sign-in-limit.ts",
    "lib/setup.ts",
    "lib/images/store.ts",
    "lib/images/upload-deadline.ts",
    "lib/images/multipart.ts",
    "lib/images/container-limits.ts",
    "lib/http/limited-body.ts",
    "next.config.ts",
    "eslint.config.mjs",
    "scripts/build-identity.mjs",
    "scripts/ci-gates.ts",
    "scripts/verify.ts",
    "scripts/drawer-auth-check.ts",
    "scripts/e2e/run.ts",
    "scripts/e2e/import-boundaries.ts",
    "scripts/e2e/readiness-bounds.ts",
    "scripts/e2e/runner-failures.ts",
    "scripts/e2e/build-identity.ts",
    "scripts/e2e/v0-foundations.ts",
    "scripts/e2e/auth-client.ts",
    "scripts/e2e/auth-contracts.ts",
    "scripts/e2e/setup-ack-fault.ts",
    "scripts/e2e/sign-in-limit-worker.ts",
    "scripts/e2e/v3-auth.ts",
    "scripts/e2e/widget-host.ts",
    "ci/fixtures/auth-widget-host.js",
    "ci/oidc-mock.ts",
    "ci/helmet-host.ts",
    "scripts/e2e/v4-social.ts",
    "scripts/e2e/v20-images.ts",
    "scripts/e2e/image-fixtures.ts",
    "scripts/e2e/image-browser.ts",
    "scripts/e2e/attachment-interactions.ts",
    "scripts/e2e/image-http-contracts.ts",
    "scripts/e2e/image-storage-contracts.ts",
    "scripts/e2e/v4-backup.ts",
    "scripts/e2e/p05-contracts.ts",
    "scripts/e2e/oidc-contracts.ts",
    "scripts/e2e/popup-callback-contracts.ts",
    "scripts/e2e/recovery-faults.ts",
    "scripts/e2e/recovery-upgrade-contracts.ts",
    "scripts/e2e/social-recovery-browser.ts",
  ]);
  return {
    checkout,
    sourceTreeHash: identity.sourceTreeHash,
    hostArtifactId: identity.artifactId,
    importBoundaries: "passed",
    readinessBounds: "passed",
    changedCodeLint: "passed",
    runnerFailures: "passed",
    buildIdentity: "passed",
    clientContracts: "passed",
    callerInventory: "passed",
  };
}
