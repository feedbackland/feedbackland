import "server-only";
import { crc32 } from "node:zlib";
import { imageSize } from "image-size";
import { BodyError } from "../http/limited-body";
function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new BodyError(415, "INVALID_IMAGE");
}
function canvas(width: number, height: number) {
  requireValid(
    width > 0 &&
      height > 0 &&
      width <= 10000 &&
      height <= 10000 &&
      width * height <= 40000000,
  );
}
function png(b: Buffer) {
  let at = 8,
    data = false,
    palette = false,
    mode = -1,
    endedData = false;
  while (at + 12 <= b.length) {
    const n = b.readUInt32BE(at),
      kind = b.toString("latin1", at + 4, at + 8),
      end = at + 8 + n;
    requireValid(
      end + 4 <= b.length &&
        /^[a-zA-Z]{4}$/.test(kind) &&
        crc32(b.subarray(at + 4, end)) === b.readUInt32BE(end),
    );
    if (at === 8) requireValid(kind === "IHDR");
    if (kind === "IHDR") {
      requireValid(at === 8 && n === 13);
      canvas(b.readUInt32BE(at + 8), b.readUInt32BE(at + 12));
      mode = b[at + 17];
      const depths: Record<number, number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      requireValid(
        depths[mode]?.includes(b[at + 16]) &&
          !b[at + 18] &&
          !b[at + 19] &&
          b[at + 20] <= 1,
      );
    } else if (kind === "PLTE") {
      requireValid(
        !data &&
          !palette &&
          mode !== 0 &&
          mode !== 4 &&
          n > 0 &&
          n <= 768 &&
          n % 3 === 0,
      );
      palette = true;
    } else if (kind === "IDAT") {
      requireValid(!endedData && (mode !== 3 || palette));
      data ||= n > 0;
    } else if (kind === "IEND") {
      requireValid(data && n === 0 && end + 4 === b.length);
      return;
    } else {
      requireValid(
        /^[a-z]/.test(kind) && !["acTL", "fcTL", "fdAT"].includes(kind),
      );
      if (data) endedData = true;
    }
    at = end + 4;
  }
  requireValid(false);
}
function gif(b: Buffer) {
  requireValid(b.length >= 14);
  const w = b.readUInt16LE(6),
    h = b.readUInt16LE(8);
  canvas(w, h);
  const table = (flags: number) => (flags & 128 ? 3 * (2 << (flags & 7)) : 0);
  let at = 13 + table(b[10]),
    frames = 0,
    duration = 0,
    delay = 1;
  function blocks(required = false) {
    let data = false;
    while (at < b.length) {
      const n = b[at++];
      if (n === 0) {
        requireValid(!required || data);
        return;
      }
      requireValid(at + n <= b.length);
      at += n;
      data = true;
    }
    requireValid(false);
  }
  while (at < b.length) {
    const marker = b[at++];
    if (marker === 0x3b) {
      requireValid(frames > 0 && at === b.length);
      return;
    }
    if (marker === 0x21) {
      const label = b[at++];
      if (label === 0xf9) {
        requireValid(
          at + 6 <= b.length &&
            b[at] === 4 &&
            b[at + 5] === 0 &&
            (b[at + 1] & 0xe0) === 0 &&
            ((b[at + 1] >> 2) & 7) <= 3,
        );
        delay = Math.max(1, b.readUInt16LE(at + 2));
        at += 6;
      } else {
        // Only application and comment extensions are non-rendering. A plain-text
        // extension is a graphic and cannot bypass the frame and duration limits.
        if (label === 0xff) {
          const n = 11;
          requireValid(b[at] === n && at + 1 + n <= b.length);
          at += 1 + n;
        } else requireValid(label === 0xfe);
        blocks();
      }
      continue;
    }
    requireValid(marker === 0x2c && at + 9 <= b.length);
    const fw = b.readUInt16LE(at + 4),
      fh = b.readUInt16LE(at + 6);
    requireValid(
      fw > 0 &&
        fh > 0 &&
        b.readUInt16LE(at) + fw <= w &&
        b.readUInt16LE(at + 2) + fh <= h,
    );
    const local = table(b[at + 8]);
    requireValid(local || table(b[10]));
    at += 9 + local;
    requireValid(b[at] >= 2 && b[at] <= 8);
    at++;
    blocks(true);
    frames++;
    duration += delay;
    delay = 1;
    requireValid(
      frames <= 100 && duration <= 6000 && w * h * frames <= 40000000,
    );
  }
  requireValid(false);
}
function jpeg(b: Buffer) {
  let at = 2,
    frame = false,
    scan = false;
  while (at < b.length) {
    requireValid(b[at++] === 255);
    while (at < b.length && b[at] === 255) at++;
    const marker = b[at++];
    if (marker === 0xd9) {
      requireValid(frame && scan && at === b.length);
      return;
    }
    requireValid(
      marker >= 0xc0 &&
        marker !== 0xd8 &&
        !(marker >= 0xd0 && marker <= 0xd7) &&
        at + 2 <= b.length,
    );
    const n = b.readUInt16BE(at);
    requireValid(n >= 2 && at + n <= b.length);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      requireValid(!frame && n >= 11 && n === 8 + 3 * b[at + 7]);
      canvas(b.readUInt16BE(at + 5), b.readUInt16BE(at + 3));
      frame = true;
    }
    if (marker === 0xda) {
      requireValid(frame && n >= 8 && n === 6 + 2 * b[at + 2]);
      scan = true;
      at += n;
      // Entropy data escapes a literal FF as FF00 and may contain restart markers.
      for (;;) {
        at = b.indexOf(255, at);
        requireValid(at >= 0 && at + 1 < b.length);
        while (b[at + 1] === 255) at++;
        const next = b[at + 1];
        if (next !== 0 && !(next >= 0xd0 && next <= 0xd7)) break;
        at += 2;
      }
    } else at += n;
  }
  requireValid(false);
}
function webp(b: Buffer) {
  requireValid(b.length >= 20 && b.readUInt32LE(4) === b.length - 8);
  let at = 12,
    extended = false,
    width = 0,
    height = 0,
    frame = false;
  while (at + 8 <= b.length) {
    const kind = b.toString("latin1", at, at + 4),
      n = b.readUInt32LE(at + 4),
      p = at + 8;
    requireValid(p + n + (n % 2) <= b.length && (!(n % 2) || b[p + n] === 0));
    requireValid(kind !== "ANIM" && kind !== "ANMF");
    if (kind === "VP8X") {
      requireValid(
        at === 12 && n === 10 && !(b[p] & 0xc3) && !b.readUIntLE(p + 1, 3),
      );
      width = 1 + b.readUIntLE(p + 4, 3);
      height = 1 + b.readUIntLE(p + 7, 3);
      canvas(width, height);
      extended = true;
    } else if (kind === "VP8 " || kind === "VP8L") {
      requireValid(!frame);
      frame = true;
      let w: number, h: number;
      if (kind === "VP8L") {
        requireValid(n > 5 && b[p] === 0x2f);
        const dimensions = b.readUInt32LE(p + 1);
        requireValid(!(dimensions >>> 29));
        w = (dimensions & 16383) + 1;
        h = ((dimensions >>> 14) & 16383) + 1;
      } else {
        requireValid(
          n > 10 && !(b[p] & 1) && b.readUIntBE(p + 3, 3) === 0x9d012a,
        );
        w = b.readUInt16LE(p + 6) & 16383;
        h = b.readUInt16LE(p + 8) & 16383;
      }
      canvas(w, h);
      requireValid(!extended || (w === width && h === height));
    } else requireValid(extended);
    at = p + n + (n % 2);
  }
  requireValid(frame && at === b.length);
}
export function inspectImage(bytes: Buffer) {
  let type: "png" | "gif" | "jpg" | "webp";
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    png(bytes);
    type = "png";
  } else if (["GIF87a", "GIF89a"].includes(bytes.toString("latin1", 0, 6))) {
    gif(bytes);
    type = "gif";
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    jpeg(bytes);
    type = "jpg";
  } else if (
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WEBP"
  ) {
    webp(bytes);
    type = "webp";
  } else throw new BodyError(415, "INVALID_IMAGE");
  try {
    const { width, height, orientation, type: detected } = imageSize(bytes);
    requireValid(type === detected);
    canvas(width, height);
    const rotated =
      type === "jpg" &&
      orientation !== undefined &&
      orientation >= 5 &&
      orientation <= 8;
    return {
      width: rotated ? height : width,
      height: rotated ? width : height,
      contentType: type === "jpg" ? "image/jpeg" : "image/" + type,
    };
  } catch {
    throw new BodyError(415, "INVALID_IMAGE");
  }
}
