import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

function key(secret: string) {
  return hkdfSync(
    "sha256",
    secret,
    Buffer.alloc(0),
    "feedbackland:ai-key:v1",
    32,
  );
}
export function sealSecret(value: string, secret: string, purpose: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), nonce);
  cipher.setAAD(Buffer.from(purpose));
  const payload = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return [
    "v1",
    nonce.toString("base64url"),
    payload.toString("base64url"),
  ].join(".");
}
export function openSecret(
  box: string,
  secret: string,
  purpose: string,
): string | null {
  try {
    if (box.length > 16384) return null;
    const parts = box.split(".");
    if (
      parts.length !== 3 ||
      parts[0] !== "v1" ||
      !parts.slice(1).every((p) => /^[A-Za-z0-9_-]+$/.test(p))
    )
      return null;
    const nonce = Buffer.from(parts[1], "base64url"),
      payload = Buffer.from(parts[2], "base64url");
    if (
      nonce.length !== 12 ||
      payload.length < 16 ||
      nonce.toString("base64url") !== parts[1] ||
      payload.toString("base64url") !== parts[2]
    )
      return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), nonce);
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(payload.subarray(-16));
    return Buffer.concat([
      decipher.update(payload.subarray(0, -16)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
