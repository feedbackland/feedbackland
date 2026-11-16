import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "../config";

export const searchLifetimeMs = 10 * 60_000;

function signature(nonce: string, expires: number) {
  return createHmac("sha256", getConfig().authSecret)
    .update(`feedbackland/search/v1/${nonce}/${expires}`)
    .digest("hex");
}

// Only issuance is free to retry. The signed deadline survives deletion of the
// database row, and all replicas can validate it with the shared instance key.
export function issueSearchCapability(nonce: string, expires: number) {
  return `${nonce}.${expires}.${signature(nonce, expires)}`;
}

export function searchExpiry(capability: string) {
  const parts = /^([a-f0-9]{64})\.(\d{13})\.([a-f0-9]{64})$/.exec(capability);
  if (!parts) return null;
  const expires = Number(parts[2]);
  return timingSafeEqual(
    Buffer.from(parts[3], "hex"),
    Buffer.from(signature(parts[1], expires), "hex"),
  )
    ? new Date(expires)
    : null;
}
