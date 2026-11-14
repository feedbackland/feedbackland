import "server-only";
import { BodyError, readBody } from "../http/limited-body";
const invalid = () => new BodyError(400, "INVALID_MULTIPART");
function validateHeaders(bytes: Buffer) {
  const lines = bytes.toString("latin1").split("\r\n");
  if (lines.length > 16) throw invalid();
  const headers = new Map<string, string>();
  for (const line of lines) {
    const match =
      /^([!#$%&'*+.^_\x60|~\w-]+):[ \t]*([^\x00-\x08\x0a-\x1f\x7f]*)$/.exec(
        line,
      );
    if (!match || headers.has(match[1].toLowerCase())) throw invalid();
    headers.set(match[1].toLowerCase(), match[2].trim());
  }
  const disposition = headers.get("content-disposition") ?? "";
  const parts = /^form-data\s*/i.exec(disposition);
  if (!parts) throw invalid();
  let rest = disposition.slice(parts[0].length);
  const params = new Map<string, string>();
  while (rest) {
    const param =
      /^;\s*([\w-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;\s]+))\s*/.exec(rest);
    if (!param || (param[3] && !/^[!#$%&\x27*+.^_`|~\w-]+$/.test(param[3])))
      throw invalid();
    const key = param[1].toLowerCase();
    if (!["name", "filename"].includes(key) || params.has(key)) throw invalid();
    params.set(key, (param[2] ?? param[3]).replace(/\\(.)/g, "$1"));
    rest = rest.slice(param[0].length);
  }
  const filename = params.get("filename");
  if (
    params.get("name") !== "file" ||
    !filename ||
    filename.length > 200 ||
    headers.has("content-transfer-encoding") ||
    headers.get("content-type")?.toLowerCase().startsWith("multipart/")
  )
    throw invalid();
}
export async function readImagePart(
  request: Request,
  maxFile: number,
  wall = 30_000,
) {
  const type = request.headers.get("content-type") ?? "";
  const match =
    /^multipart\/form-data\s*;\s*boundary=(?:"([^"]+)"|([^;\s]+))\s*$/i.exec(
      type,
    );
  const boundary = match?.[1] ?? match?.[2];
  if (
    !boundary ||
    !/^[a-zA-Z0-9'()+_,.\/:=? -]{1,70}$/.test(boundary) ||
    boundary.endsWith(" ")
  ) {
    void request.body?.cancel().catch(() => {});
    throw new BodyError(415, "MULTIPART_REQUIRED");
  }
  const opening = Buffer.from("--" + boundary);
  const delimiter = Buffer.from("\r\n--" + boundary);
  const max = maxFile + 65536;
  // Fixed storage bounds memory and copying even for adversarial chunk sizes.
  const buffer = Buffer.allocUnsafe(max);
  let length = 0,
    scan = 0,
    headerStart = 0,
    fileStart = 0,
    fileEnd = 0;
  let phase: "preamble" | "headers" | "file" | "closed" = "preamble";
  const scanPart = (chunk: Uint8Array) => {
    buffer.set(chunk, length);
    length += chunk.length;
    const input = buffer.subarray(0, length);
    while (phase !== "closed") {
      if (phase === "headers") {
        const end = input.indexOf("\r\n\r\n", scan);
        if ((end < 0 ? length - 3 : end) - headerStart > 8192) throw invalid();
        if (end < 0) {
          scan = Math.max(headerStart, length - 3);
          return;
        }
        validateHeaders(input.subarray(headerStart, end));
        fileStart = scan = end + 4;
        phase = "file";
        continue;
      }
      const first = phase === "preamble",
        marker = first ? opening : delimiter;
      const pos = input.indexOf(marker, scan);
      if (pos < 0) {
        scan = Math.max(scan, length - marker.length + 1);
        if (!first && scan - fileStart > maxFile)
          throw new BodyError(413, "FILE_TOO_LARGE");
        return;
      }
      if (
        first &&
        pos !== 0 &&
        (pos < 2 || input[pos - 2] !== 13 || input[pos - 1] !== 10)
      ) {
        scan = pos + 1;
        continue;
      }
      const end = pos + marker.length;
      if (length < end + 2) {
        scan = pos;
        return;
      }
      const next = input.readUInt16BE(end);
      if (next !== 0x0d0a && next !== 0x2d2d) {
        scan = pos + 1;
        continue;
      }
      if (first) {
        if (next !== 0x0d0a) throw invalid();
        headerStart = scan = end + 2;
        phase = "headers";
        continue;
      }
      if (next === 0x0d0a || pos === fileStart) throw invalid();
      if (pos - fileStart > maxFile) throw new BodyError(413, "FILE_TOO_LARGE");
      fileEnd = pos;
      scan = end + 2;
      phase = "closed";
    }
    // Epilogue is allowed only after a complete closing delimiter line.
    if (
      (length > scan && input[scan] !== 13) ||
      (length > scan + 1 && input[scan + 1] !== 10)
    )
      throw invalid();
  };
  await readBody(request, max, scanPart, { wall, idle: 5_000 });
  if (!fileEnd || length === scan + 1) throw invalid();
  return buffer.subarray(fileStart, fileEnd);
}
