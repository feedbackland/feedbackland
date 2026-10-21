import "server-only";
import type { Kysely } from "kysely";
import type { Pool } from "pg";
import type { DB } from "../db/schema";
export type VectorMetadata = {
  schema: string;
  version: string;
  dimensions: number;
  kind: "vector" | "halfvec";
};
export type RuntimeState = {
  pool?: Pool;
  maintenancePool?: Pool;
  db?: Kysely<DB>;
  boot?: Promise<void>;
  booted?: boolean;
  authSecret?: string;
  setupComplete?: boolean;
  vector?: VectorMetadata;
  sweepTimer?: ReturnType<typeof setTimeout>;
};
const key = Symbol.for("feedbackland.runtime");
export function runtimeState(): RuntimeState {
  const root = globalThis as typeof globalThis & { [key]?: RuntimeState };
  return (root[key] ??= {});
}
