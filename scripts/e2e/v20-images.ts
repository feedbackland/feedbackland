import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import {
  BodyError,
  boundedRequest,
  readBody,
} from "../../lib/http/limited-body";
import { readImagePart } from "../../lib/images/multipart";
import { inspectImage } from "../../lib/images/container-limits";
import { textContent } from "../../lib/utils-server";
import {
  boundary,
  disposition,
  exifJpeg,
  multipart,
  samples,
} from "./image-fixtures";
const contentType = "multipart/form-data; boundary=" + boundary;
function request(
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
) {
  return new Request("http://localhost/upload", {
    method: "POST",
    headers: { "content-type": contentType, ...headers },
    body,
    duplex: "half",
    signal,
  } as RequestInit);
}
function chunks(parts: Buffer[]) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i === parts.length) controller.close();
      else controller.enqueue(parts[i++]);
    },
  });
}
const status = (code: number) => (error: unknown) =>
  error instanceof BodyError && error.status === code;
async function multipartContracts() {
  const body = multipart(samples.png),
    max = samples.png.length;
  for (let split = 0; split <= body.length; split++) {
    const req = request(
      chunks([body.subarray(0, split), body.subarray(split)]),
    );
    assert.deepEqual(await readImagePart(req, max), samples.png);
  }
  assert.deepEqual(
    await readImagePart(
      request(chunks(Array.from(body, (b) => Buffer.from([b])))),
      max,
    ),
    samples.png,
  );
  const parse = (b: Buffer, h?: Record<string, string>) =>
    readImagePart(request(chunks([b]), h), max);
  const framed = Buffer.concat([
    Buffer.from("preamble\r\n"),
    body,
    Buffer.from("epilogue"),
  ]);
  assert.deepEqual(await parse(framed), samples.png);
  assert.deepEqual(
    await parse(body, {
      "content-type": 'multipart/form-data; boundary="' + boundary + '"',
    }),
    samples.png,
  );
  for (const cut of [
    0,
    1,
    20,
    body.length - 5,
    body.length - 3,
    body.length - 1,
  ])
    await assert.rejects(parse(body.subarray(0, cut)), status(400));
  for (const h of [
    disposition.replace('name="file"', 'name="text"'),
    disposition.split("; filename")[0],
    disposition + "\r\n" + disposition,
    disposition.replace(
      'filename="image"',
      'filename="' + "x".repeat(201) + '"',
    ),
    disposition + "\r\nContent-Type: multipart/mixed",
    disposition + "\r\nX: " + "z".repeat(8192),
    disposition +
      Array.from({ length: 16 }, (_, i) => "\r\nX-" + i + ": 1").join(""),
  ]) {
    await assert.rejects(parse(multipart(samples.png, h)), status(400));
  }
  const maxHeaders =
    disposition + "\r\nX: " + "z".repeat(8192 - disposition.length - 5);
  assert.deepEqual(
    await parse(multipart(samples.png, maxHeaders)),
    samples.png,
  );
  const extra = Buffer.concat([
    body.subarray(0, -4),
    Buffer.from("\r\n"),
    body,
  ]);
  await assert.rejects(parse(extra), status(400));
  for (const b of [
    Buffer.concat([Buffer.alloc(65536), framed]),
    Buffer.concat([body, Buffer.alloc(65536)]),
    multipart(Buffer.alloc(max + 1)),
  ])
    await assert.rejects(parse(b), status(413));
  await assert.rejects(parse(body, { "content-length": "1" }), status(400));
  await assert.rejects(
    parse(body, { "content-length": "50000000" }),
    status(413),
  );
  await assert.rejects(
    parse(body, { "content-type": "image/png" }),
    status(415),
  );
  // A sender offers 50 MB. The reader must cancel at its first crossing.
  let sent = 0,
    cancelled = false;
  const block = Buffer.alloc(4096, 0x61),
    offered = 50_000_000;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      if (sent >= offered) c.close();
      else {
        sent += block.length;
        c.enqueue(block);
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readImagePart(request(stream), max), status(413));
  assert(cancelled && sent <= max + 65536 + 2 * block.length);
  const slow = (ms: number) =>
    new ReadableStream<Uint8Array>({
      async pull(c) {
        await new Promise((r) => setTimeout(r, ms));
        try {
          c.enqueue(Buffer.from("x"));
        } catch {
          /* cancelled while sleeping */
        }
      },
    });
  await assert.rejects(
    readBody(request(slow(50)), 1024, () => {}, { wall: 200, idle: 15 }),
    status(408),
  );
  await assert.rejects(
    readBody(request(slow(3)), 1024, () => {}, { wall: 40, idle: 25 }),
    status(408),
  );
  const abort = new AbortController(),
    interrupted = readBody(
      request(slow(500), {}, abort.signal),
      1024,
      () => {},
    );
  abort.abort();
  await assert.rejects(interrupted, status(400));
  for (const cap of [65536, 262144]) {
    assert.equal(
      (
        await (
          await boundedRequest(request(chunks([Buffer.alloc(cap)])), cap)
        ).arrayBuffer()
      ).byteLength,
      cap,
    );
    await assert.rejects(
      boundedRequest(
        request(chunks([Buffer.alloc(cap), Buffer.alloc(1)])),
        cap,
      ),
      status(413),
    );
  }
}
function pngChunk(type: string, data: Buffer) {
  const b = Buffer.alloc(data.length + 12);
  b.writeUInt32BE(data.length);
  b.write(type, 4);
  b.set(data, 8);
  b.writeUInt32BE(crc32(b.subarray(4, -4)), b.length - 4);
  return b;
}
function containers() {
  for (const [type, bytes] of Object.entries(samples)) {
    assert.deepEqual(inspectImage(bytes), {
      width: 2,
      height: 1,
      contentType: "image/" + type,
    });
    for (let i = 0; i < bytes.length; i++)
      assert.throws(() => inspectImage(bytes.subarray(0, i)), status(415));
    assert.throws(
      () => inspectImage(Buffer.concat([bytes, Buffer.from("tail")])),
      status(415),
    );
  }
  assert.equal(inspectImage(exifJpeg).contentType, "image/jpeg");
  assert.throws(() => inspectImage(Buffer.from("<svg/>")), status(415));
  for (const type of ["acTL", "fcTL", "fdAT"])
    assert.throws(
      () =>
        inspectImage(
          Buffer.concat([
            samples.png.subarray(0, 33),
            pngChunk(type, Buffer.alloc(8)),
            samples.png.subarray(33),
          ]),
        ),
      status(415),
    );
  const plainTextGif = Buffer.concat([
    samples.gif.subarray(0, 19),
    Buffer.from([0x21, 1, 12]),
    Buffer.alloc(12),
    Buffer.from([1, 0x41, 0]),
    samples.gif.subarray(19),
  ]);
  assert.throws(() => inspectImage(plainTextGif), status(415));
  const damaged = Buffer.from(samples.png);
  damaged[45] ^= 1;
  assert.throws(() => inspectImage(damaged), status(415));
  for (const [w, h] of [
    [10001, 1],
    [9999, 9999],
  ]) {
    const ihdr = Buffer.from(samples.png.subarray(16, 29));
    ihdr.writeUInt32BE(w);
    ihdr.writeUInt32BE(h, 4);
    assert.throws(
      () =>
        inspectImage(
          Buffer.concat([
            samples.png.subarray(0, 8),
            pngChunk("IHDR", ihdr),
            samples.png.subarray(33),
          ]),
        ),
      status(415),
    );
  }
  function gif(frames: number, w = 2, h = 1, delay = 0) {
    const header = Buffer.from(samples.gif.subarray(0, 19));
    header.writeUInt16LE(w, 6);
    header.writeUInt16LE(h, 8);
    const frame = Buffer.from(samples.gif.subarray(19, -1));
    frame.writeUInt16LE(delay, 4);
    return Buffer.concat([
      header,
      ...Array<Buffer>(frames).fill(frame),
      Buffer.from([0x3b]),
    ]);
  }
  assert.equal(inspectImage(gif(100, 2, 1, 60)).contentType, "image/gif");
  for (const bad of [
    gif(101),
    gif(100, 2, 1, 61),
    gif(2, 5000, 5000),
    gif(1, 1, 1),
  ])
    assert.throws(() => inspectImage(bad), status(415));
  for (const which of ["flag", "ANIM", "ANMF"]) {
    const ext = Buffer.alloc(18);
    ext.write("VP8X");
    ext.writeUInt32LE(10, 4);
    ext[8] = which === "flag" ? 2 : 0;
    ext[12] = 1;
    const anim = Buffer.alloc(8);
    anim.write(which);
    const bytes = Buffer.concat([
      samples.webp.subarray(0, 12),
      ext,
      samples.webp.subarray(12),
      ...(which === "flag" ? [] : [anim]),
    ]);
    bytes.writeUInt32LE(bytes.length - 8, 4);
    assert.throws(() => inspectImage(bytes), status(415));
  }
}
async function main() {
  containers();
  await multipartContracts();
  for (const src of [
    "data:image/png;base64,AAAA",
    "bl&#111;b:pending",
    "da&#9;ta:x",
  ])
    assert.throws(
      () => textContent('<p>text<img src="' + src + '"></p>'),
      /attach|upload/i,
    );
  for (const src of [
    "https://example.invalid/x",
    "//example.invalid/x",
    "/api/images/invalid",
  ])
    assert(
      !textContent('<p>text<img src="' + src + '"></p>').content.includes(
        "<img",
      ),
    );
  console.log(
    JSON.stringify({
      formats: 4,
      allTruncations: true,
      boundarySplits: true,
      registeredBodyLimits: true,
      deadlines: true,
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
