import "server-only";
import cl100k from "js-tiktoken/ranks/cl100k_base";

// js-tiktoken scans the whole piece after every merge. Use the same pinned
// ranks and leftmost tie break, with a heap of adjacent pairs for long runs.
type Pair = { left: number; right: number; end: number; rank: number };
const earlier = (a: Pair, b: Pair) =>
  a.rank < b.rank || (a.rank === b.rank && a.left < b.left);
class Candidates {
  private heap: Pair[] = [];
  add(pair: Pair) {
    let i = this.heap.length;
    this.heap.push(pair);
    while (i > 0) {
      const parent = (i - 1) >>> 1;
      if (!earlier(pair, this.heap[parent])) break;
      this.heap[i] = this.heap[parent];
      i = parent;
    }
    this.heap[i] = pair;
  }
  pop() {
    const first = this.heap[0];
    const last = this.heap.pop();
    if (last && this.heap.length) {
      let i = 0;
      while (2 * i + 1 < this.heap.length) {
        let child = 2 * i + 1;
        if (
          child + 1 < this.heap.length &&
          earlier(this.heap[child + 1], this.heap[child])
        )
          child++;
        if (!earlier(this.heap[child], last)) break;
        this.heap[i] = this.heap[child];
        i = child;
      }
      this.heap[i] = last;
    }
    return first;
  }
}

let vocabulary: { ranks: Map<string, number>; maxBytes: number } | undefined;
function vocabularyForLongPieces() {
  if (vocabulary) return vocabulary;
  const ranks = new Map<string, number>();
  let maxBytes = 0;
  for (const line of cl100k.bpe_ranks.trim().split("\n")) {
    const [, offset, ...encoded] = line.split(" ");
    let rank = Number(offset);
    for (const token of encoded) {
      const bytes = Buffer.from(token, "base64").toString("latin1");
      ranks.set(bytes, rank++);
      maxBytes = Math.max(maxBytes, bytes.length);
    }
  }
  return (vocabulary = { ranks, maxBytes });
}
export function encodeLongPiece(bytes: Buffer) {
  const { ranks, maxBytes } = vocabularyForLongPieces();
  const n = bytes.length;
  const next = new Int32Array(n),
    previous = new Int32Array(n);
  const pairs = new Candidates();
  const offer = (left: number) => {
    if (left < 0) return;
    const right = next[left];
    if (right >= n) return;
    const end = next[right];
    if (end - left > maxBytes) return;
    const rank = ranks.get(bytes.toString("latin1", left, end));
    if (rank !== undefined) pairs.add({ left, right, end, rank });
  };
  for (let i = 0; i < n; i++) {
    next[i] = i + 1;
    previous[i] = i - 1;
  }
  for (let i = 0; i < n - 1; i++) offer(i);
  for (let pair = pairs.pop(); pair; pair = pairs.pop()) {
    const { left, right, end } = pair;
    if (next[left] !== right || next[right] !== end) continue;
    next[left] = end;
    next[right] = -1;
    if (end < n) previous[end] = left;
    offer(previous[left]);
    offer(left);
  }
  const tokens: number[] = [];
  for (let i = 0; i < n; i = next[i])
    tokens.push(ranks.get(bytes.toString("latin1", i, next[i]))!);
  return tokens;
}
