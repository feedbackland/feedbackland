import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { staticFoundations } from "./ci-gates";
import { foundations } from "./e2e/v0-foundations";
import { phaseOne } from "./e2e/v1-boot";
import { phaseThree } from "./e2e/v3-auth";
import { aiFoundations } from "./e2e/v6a-foundations";
import { phaseFive } from "./e2e/v4-backup";
import { phaseFour } from "./e2e/v4-social";
import { phaseTwo } from "./e2e/v2-surfaces";
import { removal } from "./e2e/v14-tenancy";
import { command } from "./e2e/run";

async function main() {
  const { values } = parseArgs({
    options: {
      phase: { type: "string" },
      image: { type: "string" },
      artifacts: { type: "string" },
    },
    strict: true,
  });
  if (
    !["0", "1", "2", "3", "4", "5", "6a"].includes(values.phase ?? "") ||
    !values.image ||
    !values.artifacts
  ) {
    throw new Error(
      "Usage: npm run verify -- --phase 0|1|2|3|4|5|6a --image feedbackland:ci --artifacts artifacts/self-hosting",
    );
  }
  const phase = values.phase === "6a" ? 6 : Number(values.phase);
  const runId = `p0${phase + 1}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  // Resolve once for every group, so a retag cannot mix builds during the run.
  const image = JSON.parse(
    await command("docker", ["image", "inspect", values.image]),
  )[0].Id as string;
  const directory = resolve(values.artifacts, runId);
  await mkdir(directory, { recursive: true });
  const rows: {
    check: string;
    status: string;
    evidence?: unknown;
    error?: string;
  }[] = [];
  const save = async (status: "running" | "passed" | "failed") => {
    await writeFile(
      resolve(directory, "summary.json"),
      JSON.stringify(
        {
          runId,
          phase: values.phase === "6a" ? values.phase : phase,
          image,
          status,
          checks: rows,
          futurePhases:
            phase >= 6
              ? "Search, background AI jobs and AI configuration controls are scheduled for later milestones."
              : phase >= 5
                ? "AI and search are scheduled for later phases."
                : phase >= 4
                  ? "Uploads, AI and exact/semantic search remain unavailable; no later gate is counted as passed."
                  : phase >= 3
                    ? "Social sign-in/recovery, uploads, AI and exact/semantic search remain unavailable; no later gate is counted as passed."
                    : "Authentication/setup, uploads, AI and exact/semantic search are not yet available; no later gate is counted as passed.",
        },
        null,
        2,
      ) + "\n",
    );
  };
  const check = async (name: string, action: () => Promise<unknown>) => {
    try {
      const evidence = await action();
      rows.push({ check: name, status: "passed", evidence });
      console.log(`PASS ${name}`);
    } catch (error) {
      rows.push({
        check: name,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await save(
        rows.some((row) => row.status === "failed") ? "failed" : "running",
      );
    }
  };
  try {
    await check("static/import-boundaries", staticFoundations);
    if (values.phase !== "0")
      await check("static/removal-configuration", removal);
    await foundations(image, runId, check);
    if (values.phase !== "0") await phaseOne(image, runId, check);
    if (phase >= 2) await phaseTwo(image, directory, check);
    if (phase >= 3) await phaseThree(image, runId, directory, check);
    if (phase >= 4) await phaseFour(image, runId, directory, check);
    if (phase >= 5) await phaseFive(image, runId, directory, check);
    if (phase >= 6)
      await check("V11/V12/V20/V21 OpenRouter and content moderation", () =>
        aiFoundations(runId, image),
      );
    await save("passed");
  } catch (error) {
    await save("failed");
    throw error;
  }
  console.log(`Evidence: ${directory}`);
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
