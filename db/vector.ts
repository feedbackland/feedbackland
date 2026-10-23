import "server-only";
import { sql, type Expression } from "kysely";
import { runtimeState, type VectorMetadata } from "../lib/runtime-state";
import { BootError } from "../lib/boot/errors";
import { sqlstate } from "../lib/log";

export function vectorMetadata(): VectorMetadata {
  const metadata = runtimeState().vector;
  if (!metadata) throw new Error("Vector metadata requested before boot");
  return metadata;
}
export function vectorDistance(
  column: Expression<unknown>,
  vector: readonly number[],
) {
  if (
    vector.length !== vectorMetadata().dimensions ||
    vector.some((value) => !Number.isFinite(value))
  )
    throw new Error("Invalid vector");
  return sql<number>`${column} OPERATOR(${sql.id(vectorMetadata().schema)}.<=>) ${JSON.stringify(vector)}`;
}
export async function discoverVector(
  trx: import("kysely").Kysely<import("./schema").DB>,
  dimensions: number,
): Promise<VectorMetadata> {
  try {
    await sql`create extension if not exists vector`.execute(trx);
  } catch (error) {
    const code = sqlstate(error);
    if (["0A000", "58P01"].includes(code ?? ""))
      throw new BootError(
        "vector-extension",
        "pgvector is unavailable; use a Postgres image or provider that includes it.",
        code,
      );
    if (code === "42501")
      throw new BootError(
        "vector-extension",
        "The database role cannot create extensions; ask the provider to install pgvector once.",
        code,
      );
    throw error;
  }
  const { rows } = await sql<{
    schema: string;
    version: string;
  }>`select n.nspname as schema, e.extversion as version from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='vector'`.execute(
    trx,
  );
  const row = rows[0];
  if (!row || !/^\d+\.\d+\.\d+/.test(row.version))
    throw new BootError(
      "vector-extension",
      "pgvector extension metadata is missing or has an unsupported version",
    );
  const [major, minor] = row.version.split(".").map(Number);
  const minimum = dimensions > 2000 ? 7 : 5;
  if (major === 0 && minor < minimum)
    throw new BootError(
      "vector-version",
      `pgvector ${row.version} is installed; dimensions ${dimensions} require 0.${minimum}.0`,
    );
  return { ...row, dimensions, kind: dimensions > 2000 ? "halfvec" : "vector" };
}
