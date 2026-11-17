// Shared validation and fixed display copy. Provider responses never become UI copy.
export function keyProblem(input: string) {
  if (/^sk-or-v1-[A-Za-z0-9_-]{8,256}$/.test(input)) return null;
  const service = /^sk-ant-/.test(input)
    ? "Anthropic"
    : /^(?:AIza|AQ\.)/.test(input)
      ? "Google"
      : /^sk-(?:proj-|svcacct-)/.test(input) ||
          (/^sk-/.test(input) && input.includes("T3BlbkFJ"))
        ? "OpenAI"
        : null;
  return service
    ? "This is " +
        (service === "Google" ? "a " : "an ") +
        service +
        " key. Connect OpenRouter to use models from this provider."
    : "OpenRouter keys start with sk-or-v1-.";
}
export function issueText(issue: string | null | undefined) {
  const text: Record<string, string> = {
    "invalid-key": "This key is invalid.",
    "provider-auth": "OpenRouter rejected the key.",
    "management-key":
      "This is a management key. Create a regular key or connect OpenRouter.",
    "expired-key": "This key has expired.",
    "account-credit": "Your OpenRouter account is out of credit.",
    "key-limit": "This key has reached its spend limit.",
    "request-exceeds-balance": "This request exceeds the account balance.",
    "provider-credit": "Check your OpenRouter credit and key spend limit.",
    "model-unavailable": "This model is unavailable to your account.",
    privacy: "No provider for this model meets the selected privacy policy.",
    "provider-rate": "OpenRouter is rate-limiting this key.",
    timeout: "The model timed out. Test again or select a faster model.",
    network: "This server could not reach OpenRouter.",
    "invalid-response": "OpenRouter returned an unusable response.",
    "rebuild-required":
      "The existing search index uses a different configuration. Rebuild it to index this board with the selected embedding model.",
    "dimension-mismatch": "The embedding width differs from the search index.",
    budget: "The ordinary daily allowance is exhausted.",
    busy: "All available model slots are busy.",
    "unsupported-model": "This embedding model has no supported tokenizer.",
    unreadable: "The server secret changed. Reconnect the stored key.",
    "invalid-environment": "An AI environment setting is invalid.",
    "replica-mismatch": "AI settings differ across replicas.",
    "provider-error": "OpenRouter could not complete the request.",
  };
  return text[issue ?? ""] ?? "The connection could not be verified.";
}
export const envNames: Record<string, string> = {
  model: "OPENROUTER_MODEL",
  embeddingModel: "OPENROUTER_EMBEDDING_MODEL",
  privacy: "OPENROUTER_PRIVACY",
  dailyCallLimit: "AI_DAILY_CALL_LIMIT",
  timeoutMs: "AI_TIMEOUT_MS",
  searchMaxDistance: "AI_SEARCH_MAX_DISTANCE",
};
export const aiSettingsPath = "/admin/settings/ai";
