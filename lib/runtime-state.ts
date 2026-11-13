import "server-only";
import type { Kysely } from "kysely";
import type { Pool } from "pg";
import type { DB } from "../db/schema";
import type { Auth } from "./auth/server";
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
  auth?: Auth;
  authDiscovery?: {
    epoch: string | null;
    lastPoll: number;
    lastAttempt: number;
    failed: boolean;
    pending?: Promise<void>;
    poll?: Promise<void>;
    controller?: AbortController;
    timer?: ReturnType<typeof setTimeout>;
  };
  setupComplete?: boolean;
  vector?: VectorMetadata;
  sweepTimer?: ReturnType<typeof setTimeout>;
};
const key = Symbol.for("feedbackland.runtime");
export function runtimeState(): RuntimeState {
  const root = globalThis as typeof globalThis & { [key]?: RuntimeState };
  return (root[key] ??= {});
}
