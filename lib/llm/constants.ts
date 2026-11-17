import "server-only";

export const OPENROUTER_API = "https://openrouter.ai/api/v1";
export const OPENROUTER_AUTH = "https://openrouter.ai/auth";
import { modelResponseBytes } from "../ai-request-limits";
export const MODEL_RESPONSE_BYTES = modelResponseBytes;
export const METADATA_RESPONSE_BYTES = 4 * MODEL_RESPONSE_BYTES;
export const VISION_WORK_BYTES = 32 * 1024 * 1024;
export const FEATURES = [
  "moderation",
  "title",
  "rewrite",
  "ask-ai",
  "insights",
  "embed-write",
  "embed-query",
  "backfill",
  "check",
  "probe",
] as const;
export type Feature = (typeof FEATURES)[number];
export type Capability = "chat" | "embeddings";
