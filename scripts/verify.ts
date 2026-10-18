import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { staticFoundations } from "./ci-gates";
import { foundations } from "./e2e/v0-foundations";

async function main() {
  const { values } = parseArgs({
    options: {
      phase: { type: "string" },
      image: { type: "string" },
      artifacts: { type: "string" },
    },
    strict: true,
  });
  if (values.phase !== "0" || !values.image || !values.artifacts) {
    throw new Error(
      "Usage: npm run verify -- --phase 0 --image feedbackland:ci --artifacts artifacts/self-hosting (only phase 0 is implemented)",
    );
  }
  const runId = `p01-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
          phase: 0,
          image: values.image,
          status,
          checks: rows,
          futurePhases: "not yet due",
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
    await foundations(values.image, runId, check);
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
