import "server-only";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k from "js-tiktoken/ranks/cl100k_base";
import { AiError } from "./errors";
import { utf8Prefix } from "./input-budgets";

const supported = new Set([
  "openai/text-embedding-3-small",
  "openai/text-embedding-3-large",
]);
let tokenizer: Tiktoken | undefined;
export function prepareEmbedding(model: string, text: string, query = false) {
  if (!supported.has(model))
    throw new AiError("UNSUPPORTED_EMBEDDING_TOKENIZER");
  // No single input can use more than the entire batch's byte allowance.
  let source = utf8Prefix(text.trim(), 128000, query ? 200 : Infinity);
  // js-tiktoken merges one token pair at a time. A single uninterrupted
  // lexical piece can take quadratic CPU even below the batch byte limit.
  // Preserve an exact prefix, then count that actual string with cl100k.
  for (const piece of source.matchAll(new RegExp(cl100k.pat_str, "ug"))) {
    if (Buffer.byteLength(piece[0]) > 1024) {
      source = source.slice(0, piece.index) + utf8Prefix(piece[0], 1024);
      break;
    }
  }
  if (!source) return null;
  const enc = (tokenizer ??= new Tiktoken(cl100k));
  const tokens = enc.encode(source, [], []);
  if (tokens.length <= 8000)
    return {
      text: source,
      tokens: tokens.length,
      bytes: Buffer.byteLength(source),
    };
  let end = 8000;
  // A token can end inside a Unicode scalar. Accept only a verified prefix.
  while (end > 0) {
    const out = enc.decode(tokens.slice(0, end--));
    if (!source.startsWith(out)) continue;
    const n = enc.encode(out, [], []).length;
    if (n <= 8000)
      return { text: out, tokens: n, bytes: Buffer.byteLength(out) };
  }
  throw new AiError("invalid-input");
}
export function embeddingBatch(
  model: string,
  items: readonly string[],
  query = false,
) {
  if (items.length > 64 || (query && items.length !== 1))
    throw new AiError("invalid-input");
  const values: string[] = [];
  let tokens = 0,
    bytes = 0;
  for (const item of items) {
    const prepared = prepareEmbedding(model, item, query);
    if (!prepared) continue;
    tokens += prepared.tokens;
    bytes += prepared.bytes;
    if (tokens > 32000 || bytes > 128000) throw new AiError("invalid-input");
    values.push(prepared.text);
  }
  return values;
}
