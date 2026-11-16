import "server-only";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k from "js-tiktoken/ranks/cl100k_base";
import { AiError } from "./errors";
import { utf8Prefix } from "./input-budgets";

import { encodeLongPiece } from "./long-piece";
function encode(text: string, enc: Tiktoken) {
  const tokens: number[] = [];
  let start = 0;
  for (const match of text.matchAll(new RegExp(cl100k.pat_str, "ug"))) {
    if (Buffer.byteLength(match[0]) <= 1024) continue;
    for (const t of enc.encode(text.slice(start, match.index), [], []))
      tokens.push(t);
    for (const t of encodeLongPiece(Buffer.from(match[0]))) tokens.push(t);
    start = match.index + match[0].length;
  }
  if (!start) return enc.encode(text, [], []);
  for (const t of enc.encode(text.slice(start), [], [])) tokens.push(t);
  return tokens;
}

const supported = new Set([
  "openai/text-embedding-3-small",
  "openai/text-embedding-3-large",
]);
export const supportsEmbeddingModel = (model: string) => supported.has(model);
let tokenizer: Tiktoken | undefined;
export function prepareEmbedding(model: string, text: string, query = false) {
  if (!supported.has(model))
    throw new AiError("UNSUPPORTED_EMBEDDING_TOKENIZER");
  // No single input can use more than the entire batch's byte allowance.
  const source = utf8Prefix(text.trim(), 128000, query ? 200 : Infinity);
  if (!source) return null;
  const enc = (tokenizer ??= new Tiktoken(cl100k));
  const tokens = encode(source, enc);
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
    const n = encode(out, enc).length;
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
  const values: { index: number; text: string }[] = [];
  let tokens = 0,
    bytes = 0;
  for (const [index, item] of items.entries()) {
    const prepared = prepareEmbedding(model, item, query);
    if (!prepared) continue;
    tokens += prepared.tokens;
    bytes += prepared.bytes;
    if (tokens > 32000 || bytes > 128000) throw new AiError("invalid-input");
    values.push({ index, text: prepared.text });
  }
  return values;
}
