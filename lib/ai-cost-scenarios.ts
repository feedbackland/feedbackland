import {
  inputBytes,
  maxVisionImages,
  backfillTokens,
  backfillRows,
  backfillControl,
  embeddingRequestLimit,
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
  requestPrice?: string | null;
};
export function largeRequestScenarios(
  chat: string,
  embeddings: string,
  prices: Price[],
  dimensions = 768,
) {
  const price = prices.find((p) => p.id === embeddings);
  const embedding = (
    feature: string,
    tokens: number,
    attempts: number,
    assumption = "",
  ) => ({
    feature,
    model: embeddings,
    shape:
      "up to " +
      tokens.toLocaleString("en-US") +
      " input tokens total across " +
      attempts +
      " request" +
      (attempts === 1 ? "" : "s") +
      assumption,
    cost:
      [
        "openai/text-embedding-3-small",
        "openai/text-embedding-3-large",
      ].includes(embeddings) &&
      price?.inputPrice != null &&
      price.requestPrice != null
        ? tokens * Number(price.inputPrice) +
          attempts * Number(price.requestPrice)
        : null,
  });
  const batchSize = Math.min(backfillRows, embeddingRequestLimit(dimensions));
  const batches = Math.ceil(backfillRows / batchSize);
  // Each partition is a binary tree. Rejected nodes issue one control and rejected leaves one final retry.
  const nodes = 2 * backfillRows - batches;
  const fallbackTokens =
    (2 + Math.ceil(Math.log2(batchSize))) * backfillTokens +
    nodes * backfillControl.length;
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
    bounded(
      "Moderation · up to " + maxVisionImages + " eligible images",
      "moderation",
    ),
    text(
      "Moderation · image request and text-only fallback",
      inputBytes.moderation,
      outputTokens.moderation,
      2,
    ),
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
    embedding(
      "Backfill batch",
      backfillTokens,
      batches,
      " for up to " + backfillRows + " items",
    ),
    embedding(
      "Backfill · rejected inputs and split retries",
      fallbackTokens,
      2 * nodes + backfillRows,
      " if every nonempty input is rejected and each fixed control succeeds",
    ),
    embedding("Probe · fixed text", probeText.length, 1),
    embedding(
      "Live embedding check · fixed text",
      connectionText.length * 2,
      2,
    ),
  ];
}
