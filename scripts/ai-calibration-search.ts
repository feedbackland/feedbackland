import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validCosineVector } from "../lib/vector-values";
import { command, eventually } from "./e2e/run";

const image =
  "pgvector/pgvector@sha256:2358fcba361ed2233a5ed81b5fe4ca779ccb304120ce531a3bf51c0ed7e2bc11";
export const calibrationWidth = 768;
export type CalibrationPair = {
  id: string;
  expected: "related" | "unrelated";
  query: number[];
  document: number[];
};

export async function verifyCalibrationDatabase() {
  await command("docker", ["image", "inspect", "--format", "{{.Id}}", image]);
}

export async function measureSearchDistances(
  pairs: readonly CalibrationPair[],
) {
  const name = "p12-distances-" + randomUUID().slice(0, 10);
  const docker = (...args: string[]) => command("docker", args);
  const sql = pairs
    .map(({ query, document }, index) => {
      assert(validCosineVector(query, calibrationWidth));
      assert(validCosineVector(document, calibrationWidth));
      return (
        "select " +
        index +
        ", '[" +
        document.join(",") +
        "]'::vector(768) <=> '[" +
        query.join(",") +
        "]'::vector(768);"
      );
    })
    .join("\n");
  await docker(
    "run",
    "--detach",
    "--pull=never",
    "--network",
    "none",
    "--name",
    name,
    "--tmpfs",
    "/var/lib/postgresql",
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    image,
  );
  try {
    await eventually(
      () =>
        docker("exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"),
      (line) => line.includes("accepting connections"),
      30_000,
    );
    const result = await command(
      "docker",
      [
        "exec",
        "-i",
        name,
        "psql",
        "-XAtq",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
      ],
      { input: "create extension vector;\n" + sql },
    );
    const lines = result.split(/\r?\n/);
    assert.equal(lines.length, pairs.length);
    return pairs.map(({ id, expected }, i) => {
      const [index, value] = lines[i].split("|");
      assert.equal(index, String(i));
      const distance = Number(value);
      assert(value && Number.isFinite(distance));
      return { id, expected, distance };
    });
  } finally {
    await docker("rm", "-fv", name);
  }
}

export function searchCutoff(
  distances: Awaited<ReturnType<typeof measureSearchDistances>>,
  current: number,
) {
  const related = distances.filter((pair) => pair.expected === "related");
  const unrelated = distances.filter((pair) => pair.expected === "unrelated");
  assert(related.length && unrelated.length);
  const farthestRelated = Math.max(...related.map((pair) => pair.distance));
  const nearestUnrelated = Math.min(...unrelated.map((pair) => pair.distance));
  const separates = farthestRelated < nearestUnrelated;
  const midpoint = separates ? (farthestRelated + nearestUnrelated) / 2 : null;
  return {
    distances,
    farthestRelated,
    nearestUnrelated,
    searchMaxDistance: midpoint,
    currentDefault: current,
    currentIsMeasuredMidpoint: midpoint === current,
    currentSeparates: current >= farthestRelated && current < nearestUnrelated,
  };
}
