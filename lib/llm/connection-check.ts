import "server-only";
import { z } from "zod";
import { AiError } from "./errors";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGNsaGhgwAaYsIoOWgkAMBcBkGHHl6YAAAAASUVORK5CYII=",
  "base64",
);
export const checkImage = {
  id: "connection-check",
  contentType: "image/png",
  width: 8,
  height: 8,
  byteSize: png.length,
  load: async () => png,
};
const expected = z.object({ ok: z.literal(true) });
export function validateConnectionReply(text: string) {
  try {
    if (expected.safeParse(JSON.parse(text)).success) return true;
  } catch {
    // Expose the fixed reason only.
  }
  throw new AiError("invalid-response");
}
