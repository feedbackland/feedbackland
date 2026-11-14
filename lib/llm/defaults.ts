import "server-only";
import { z } from "zod";

const model = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/);
export const optionsSchema = z
  .object({
    model,
    embeddingModel: model,
    privacy: z.enum(["deny", "zdr", "allow"]),
    vision: z.boolean(),
    timeoutMs: z.number().int().min(1000).max(120000),
    dailyCallLimit: z.number().int().min(10).max(1_000_000),
  })
  .partial()
  .strict();
export type Options = Required<z.infer<typeof optionsSchema>>;
export const defaults: Options = {
  model: "google/gemini-3.8-flash",
  embeddingModel: "openai/text-embedding-3-small",
  privacy: "deny",
  vision: true,
  timeoutMs: 15000,
  dailyCallLimit: 5000,
};
export const keySchema = z
  .string()
  .min(5)
  .max(2048)
  .regex(/^[\x21-\x7e]+$/);
export const outputTokens = {
  moderation: 1024,
  title: 1024,
  rewrite: 2048,
  "ask-ai": 4096,
  insights: 4096,
  check: 64,
} as const;
export const inputBytes = {
  moderation: 48000,
  title: 48000,
  rewrite: 48000,
  "ask-ai": 128000,
  insights: 64000,
  check: 48000,
} as const;
export type ChatFeature = keyof typeof outputTokens;
export function privacyRouting(privacy: Options["privacy"]) {
  return privacy === "zdr"
    ? { data_collection: "deny", zdr: true }
    : { data_collection: privacy };
}
