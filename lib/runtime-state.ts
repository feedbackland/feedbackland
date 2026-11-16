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
  indexesValid?: boolean;
};
export type RuntimeState = {
  aiConfigGeneration?: number;
  aiConfig?: {
    value: import("./llm/settings-store").Configuration;
    until: number;
  };
  aiReplicaId?: string;
  aiLeaseTimer?: ReturnType<typeof setTimeout>;
  unreadableAiKey?: string;
  aiWork?: { model: number; vision: number; metadata: number };
  pool?: Pool;
  maintenancePool?: Pool;
  db?: Kysely<DB>;
  boot?: Promise<void>;
  booted?: boolean;
  uploads?: number;
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
  vectorEpoch?: string;
  embeddingProbe?: {
    identity: string;
    ready: boolean;
    reason: string;
    attempt: number;
    next: number;
    expected?: number;
    actual?: number;
    checked?: string;
    pending?: Promise<void>;
  };
  activeEmbeddingWrites?: Set<Promise<void>>;
  aiMaintenance?: { stop: () => Promise<void> };
  sweepTimer?: ReturnType<typeof setTimeout>;
};
const key = Symbol.for("feedbackland.runtime");
export function runtimeState(): RuntimeState {
  const root = globalThis as typeof globalThis & { [key]?: RuntimeState };
  return (root[key] ??= {});
}
