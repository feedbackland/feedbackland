"server-only";

import { checkRateLimit } from "@/queries/check-rate-limit";

/**
 * Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform to
 * the real client IP and cannot be spoofed — Vercel overwrites it and does not
 * forward external values (`x-real-ip` / `x-vercel-forwarded-for` are identical
 * copies). Behind some other proxy the leftmost entry may be client-controlled,
 * which is why the per-org limit below is the real cost cap and this is only a
 * secondary control. Falls back to a shared "unknown" bucket so a request with
 * no IP is still counted, and the value is length-capped so it can never bloat
 * the key space.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  const candidate =
    forwardedFor?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown";

  // Longest possible IPv6 textual form is 45 chars; anything longer is junk.
  return candidate.slice(0, 45);
}

/**
 * Ceilings for the endpoints that each spend LLM calls. Deliberately generous
 * for a human posting or a backend piping feedback through the API, while
 * turning an unbounded credit-burn from a single source into a bounded one.
 * Tune here in one place.
 */
export const RATE_LIMITS = {
  feedbackCreate: {
    ip: { limit: 20, windowSeconds: 60 },
    org: { limit: 120, windowSeconds: 60 },
  },
  rewrite: {
    ip: { limit: 20, windowSeconds: 60 },
    org: { limit: 120, windowSeconds: 60 },
  },
} as const;

/**
 * Enforce a list of limits IN ORDER, stopping at the first one that trips. The
 * ordering matters: the caller puts the higher-cardinality key (IP) first so a
 * blocked request never reaches — and never inserts a row for — the next key.
 * That is what keeps a flood from bloating the table with one row per attempt.
 */
async function enforceInOrder(
  checks: ReadonlyArray<{ key: string; limit: number; windowSeconds: number }>,
): Promise<{ allowed: boolean }> {
  for (const check of checks) {
    const { allowed } = await checkRateLimit(check);
    if (!allowed) return { allowed: false };
  }
  return { allowed: true };
}

/** Per-IP then per-org limit for creating a feedback post (3 LLM calls each). */
export function enforceFeedbackCreateLimit({
  ip,
  orgId,
}: {
  ip: string;
  orgId: string;
}) {
  return enforceInOrder([
    { key: `feedback-create:ip:${ip}`, ...RATE_LIMITS.feedbackCreate.ip },
    { key: `feedback-create:org:${orgId}`, ...RATE_LIMITS.feedbackCreate.org },
  ]);
}

/** Per-IP then per-org limit for the "improve my draft" rewrite (1 LLM call). */
export function enforceRewriteLimit({
  ip,
  orgId,
}: {
  ip: string;
  orgId: string;
}) {
  return enforceInOrder([
    { key: `rewrite:ip:${ip}`, ...RATE_LIMITS.rewrite.ip },
    { key: `rewrite:org:${orgId}`, ...RATE_LIMITS.rewrite.org },
  ]);
}
