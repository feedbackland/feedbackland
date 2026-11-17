export const maxVisionImages = 4;
export const backfillRows = 64;
export const backfillTokens = 32000;
export const backfillControl = "Feedbackland index check";
export const modelResponseBytes = 1024 * 1024;
export function embeddingRequestLimit(dimensions: number) {
  return Math.max(
    1,
    Math.floor((modelResponseBytes - 16384) / (dimensions * 25 + 128)),
  );
}
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
export const probeText = "Feedbackland search index dimension check";
export const connectionText = "Feedbackland search connection check";
export const connectionChat = {
  system: 'For this connection check return the JSON object {"ok":true}.',
  text: "A request to improve board navigation.",
} as const;
