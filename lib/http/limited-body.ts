import "server-only";
import { performance } from "node:perf_hooks";

export class BodyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
  response(headers?: HeadersInit) {
    return Response.json(
      { error: this.code },
      { status: this.status, headers },
    );
  }
}
export function discardBody(request: Request) {
  if (request.body && !request.body.locked)
    void request.body.cancel().catch(() => {});
}
export function checkLength(request: Request, limit: number) {
  const length = request.headers.get("content-length");
  if (length === null) return;
  if (!/^\d+$/.test(length)) throw new BodyError(400, "INVALID_LENGTH");
  if (Number(length) > limit) throw new BodyError(413, "BODY_TOO_LARGE");
}

// One timer for the whole read. Avoid accumulating per-chunk callbacks on a
// never-settled timeout promise when a sender uses one-byte chunks.
export async function readBody(
  request: Request,
  limit: number,
  consume: (bytes: Uint8Array) => void,
  deadlines = { wall: 30_000, idle: 5_000 },
) {
  try {
    checkLength(request, limit);
  } catch (error) {
    discardBody(request);
    throw error;
  }
  if (!request.body) throw new BodyError(400, "MISSING_BODY");
  const reader = request.body.getReader();
  const start = performance.now();
  let last = start,
    count = 0,
    failure: BodyError | undefined;
  let timer: ReturnType<typeof setTimeout>;
  const stop = (error: BodyError) => {
    failure ??= error;
    void reader.cancel().catch(() => {});
  };
  const remaining = () =>
    Math.min(start + deadlines.wall, last + deadlines.idle) - performance.now();
  const tick = () => {
    const left = remaining();
    if (left <= 0) stop(new BodyError(408, "BODY_TIMEOUT"));
    else timer = setTimeout(tick, Math.ceil(left));
  };
  const aborted = () => stop(new BodyError(400, "BODY_INTERRUPTED"));
  request.signal.addEventListener("abort", aborted, { once: true });
  tick();
  try {
    if (request.signal.aborted) aborted();
    for (;;) {
      const { value, done } = await reader.read();
      if (failure) throw failure;
      if (remaining() <= 0) throw new BodyError(408, "BODY_TIMEOUT");
      if (done) break;
      if (!value.length) continue;
      count += value.length;
      if (count > limit) throw new BodyError(413, "BODY_TOO_LARGE");
      last = performance.now();
      consume(value);
    }
    const declared = request.headers.get("content-length");
    if (declared !== null && Number(declared) !== count)
      throw new BodyError(400, "LENGTH_MISMATCH");
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error instanceof BodyError
      ? error
      : new BodyError(400, "BODY_INTERRUPTED");
  } finally {
    clearTimeout(timer!);
    request.signal.removeEventListener("abort", aborted);
    reader.releaseLock();
  }
}

// JSON consumers receive a bounded, replayable Request even when their
// framework wraps the incoming Request or would buffer an unbounded stream.
export async function boundedRequest(
  request: Request,
  limit: number,
  headers = request.headers,
) {
  if (!request.body) {
    checkLength(request, limit);
    return new Request(request.url, {
      method: request.method,
      headers,
      signal: request.signal,
    });
  }
  let size = 0;
  const blocks: Buffer[] = [];
  await readBody(request, limit, (bytes) => {
    let offset = 0;
    while (offset < bytes.length) {
      const used = size % 16384;
      if (!used) blocks.push(Buffer.allocUnsafe(16384));
      const length = Math.min(16384 - used, bytes.length - offset);
      blocks[blocks.length - 1].set(
        bytes.subarray(offset, offset + length),
        used,
      );
      offset += length;
      size += length;
    }
  });
  const body = Buffer.concat(blocks, size);
  return new Request(request.url, {
    method: request.method,
    headers,
    body,
    signal: request.signal,
  });
}
