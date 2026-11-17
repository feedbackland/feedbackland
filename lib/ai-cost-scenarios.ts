import {
  inputBytes,
  outputTokens,
  connectionChat,
  connectionText,
  probeText,
  type ChatFeature,
} from "./ai-request-limits";
type Price = {
  id: string;
  inputPrice: string | null;
  outputPrice: string | null;
};
export function largeRequestScenarios(
  chat: string,
  embeddings: string,
  prices: Price[],
) {
  const embeddingPrice = prices.find((p) => p.id === embeddings)?.inputPrice;
  const embedding = (feature: string, tokens: number, attempts: number) => ({
    feature,
    model: embeddings,
    shape:
      "up to " +
      tokens.toLocaleString("en-US") +
      " input tokens × " +
      attempts +
      " attempt" +
      (attempts === 1 ? "" : "s"),
    cost:
      [
        "openai/text-embedding-3-small",
        "openai/text-embedding-3-large",
      ].includes(embeddings) && embeddingPrice != null
        ? tokens * attempts * Number(embeddingPrice)
        : null,
  });
  const text = (
    feature: string,
    bytes: number,
    output: number,
    attempts = 1,
  ) => ({
    feature,
    model: chat,
    shape:
      bytes.toLocaleString("en-US") +
      " input bytes, " +
      output.toLocaleString("en-US") +
      " output tokens × " +
      attempts +
      " attempt" +
      (attempts === 1 ? "" : "s"),
    cost: null,
  });
  const bounded = (name: string, feature: ChatFeature) =>
    text(name, inputBytes[feature], outputTokens[feature]);
  // The supported embedding tokenizer uses byte-level BPE. A 200-scalar query
  // is at most 800 bytes; the two ASCII samples also have fixed byte ceilings.
  return [
    bounded("Moderation · up to two images", "moderation"),
    bounded("Title and category", "title"),
    bounded("Improve draft", "rewrite"),
    bounded("Ask AI · history and post corpus", "ask-ai"),
    bounded("Insights · each chunk", "insights"),
    bounded("Insights · final merge", "insights"),
    text(
      "Live chat check · one 8×8 image with vision",
      connectionChat.system.length + connectionChat.text.length,
      outputTokens.check,
      2,
    ),
    embedding("Post or comment embedding", 8000, 1),
    embedding("Query embedding · up to 200 characters", 800, 1),
    embedding("Backfill batch", 32000, 1),
    embedding("Probe · fixed text", probeText.length, 1),
    embedding("Live embedding check · fixed text", connectionText.length, 2),
  ];
}
