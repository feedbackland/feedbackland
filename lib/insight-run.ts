const messages = {
  AI_NOT_CONFIGURED: "Connect an AI provider to generate insights.",
  AI_UNAVAILABLE:
    "The AI provider needs attention. Check its status in System.",
  AI_PAUSED: "The daily AI allowance cannot cover this analysis.",
  INSIGHT_PLAN_TOO_LARGE:
    "This analysis needs more calls than a full daily allowance permits. Increase AI_DAILY_CALL_LIMIT and start again.",
  AI_BUSY: "The AI provider is busy. Try starting a new analysis later.",
  CONFIGURATION_DIVERGED:
    "This server has different AI settings from the active configuration.",
  STALE_CONFIGURATION:
    "AI settings changed during the analysis. Start a new analysis.",
  RESERVATION_EXPIRED:
    "The reserved allowance or worker lease expired. Start a new analysis.",
  "stale-run": "The worker stopped before publishing. Start a new analysis.",
  NO_OPEN_FEEDBACK: "There is no open feedback to analyse.",
  "key-unreadable":
    "The saved AI key could not be read. Reconnect the provider.",
  "provider-auth": "The AI provider rejected the key. Reconnect the provider.",
  "provider-credit": "The AI provider has no remaining credit.",
  "provider-rate":
    "The AI provider is rate limiting requests. Try again later.",
  timeout: "The AI provider took too long to respond.",
  "invalid-response": "The AI provider returned an unusable analysis.",
  "response-too-large": "The analysis exceeded the size limit.",
  "provider-refusal": "The AI provider declined to analyse this feedback.",
  "data-policy":
    "The provider could not satisfy the configured privacy policy.",
  "provider-error": "The AI provider could not complete the analysis.",
  "job-failed":
    "The analysis could not be completed. Start a new analysis to try again.",
} as const;
export type InsightFailure = keyof typeof messages;
export const insightFailure = (reason: unknown): InsightFailure =>
  typeof reason === "string" && Object.hasOwn(messages, reason)
    ? (reason as InsightFailure)
    : "job-failed";
export function insightFailureMessage(reason: unknown) {
  return messages[insightFailure(reason)];
}
