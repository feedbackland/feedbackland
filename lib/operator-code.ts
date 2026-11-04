import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { validateCode } from "./config";

function bytes(code: string) {
  return Buffer.from(code, /^[0-9a-fA-F]{64}$/.test(code) ? "hex" : "base64");
}
export function matchesOperatorCode(input: string, expected?: string) {
  if (!expected) return false;
  let valid = false;
  try {
    valid = !!validateCode("RECOVERY_CODE", input);
  } catch {}
  const candidate = valid ? bytes(input) : Buffer.alloc(32);
  return timingSafeEqual(candidate, bytes(expected)) && valid;
}
export function operatorCodeDigest(code: string) {
  return createHash("sha256").update(bytes(code)).digest("hex");
}
