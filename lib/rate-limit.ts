import "server-only";
import { checkRateLimit, consumeRateLimit } from "@/queries/check-rate-limit";
import {
  uploadTransaction,
  type UploadDeadline,
} from "./images/upload-deadline";
import { log, sqlstate } from "./log";
import { BodyError } from "./http/limited-body";
export { getClientIp } from "./client-ip";
export const RATE_LIMITS = {
  feedbackCreate: {
    ip: { limit: 20, windowSeconds: 60 },
    instance: { limit: 120, windowSeconds: 60 },
  },
  commentCreate: {
    user: { limit: 30, windowSeconds: 60 },
    instance: { limit: 300, windowSeconds: 60 },
  },
  edit: {
    user: { limit: 30, windowSeconds: 60 },
    instance: { limit: 300, windowSeconds: 60 },
  },
  searchText: {
    ip: { limit: 60, windowSeconds: 60 },
    instance: { limit: 600, windowSeconds: 60 },
  },
  rewrite: {
    ip: { limit: 20, windowSeconds: 60 },
    instance: { limit: 120, windowSeconds: 60 },
  },
  searchEmbedding: {
    ip: { limit: 30, windowSeconds: 60 },
    instance: { limit: 300, windowSeconds: 60 },
  },
  askAi: {
    user: { limit: 10, windowSeconds: 60 },
    instance: { limit: 60, windowSeconds: 60 },
  },
  images: {
    ip: { limit: 30, windowSeconds: 60 },
    instance: { limit: 60, windowSeconds: 60 },
  },
  signInEmail: { limit: 10, windowSeconds: 900 },
  signUp: { limit: 30, windowSeconds: 60 },
  setup: { limit: 5, windowSeconds: 900 },
  recover: { limit: 5, windowSeconds: 900 },
  popupHandoff: { limit: 120, windowSeconds: 60 },
  aiCheck: { limit: 10, windowSeconds: 60 },
} as const;
async function enforceInOrder(
  checks: ReadonlyArray<{ key: string; limit: number; windowSeconds: number }>,
) {
  for (const check of checks)
    if (!(await checkRateLimit(check)).allowed) return { allowed: false };
  return { allowed: true };
}
export function enforceFeedbackCreateLimit({
  ip,
  source = "board",
}: {
  ip: string;
  source?: "board" | "api";
}) {
  return enforceInOrder([
    {
      key: `feedback-create:${source}:ip:${ip}`,
      ...RATE_LIMITS.feedbackCreate.ip,
    },
    {
      key: `feedback-create:${source}:instance`,
      ...RATE_LIMITS.feedbackCreate.instance,
    },
  ]);
}
export function enforceContentLimit(
  feature: "edit" | "commentCreate",
  userId: string,
) {
  const prefix = feature === "edit" ? "edit" : "comment-create";
  return enforceInOrder([
    { key: prefix + ":user:" + userId, ...RATE_LIMITS[feature].user },
    { key: prefix + ":instance", ...RATE_LIMITS[feature].instance },
  ]);
}
export function enforceRewriteLimit(ip: string) {
  return enforceInOrder([
    { key: "rewrite:ip:" + ip, ...RATE_LIMITS.rewrite.ip },
    { key: "rewrite:instance", ...RATE_LIMITS.rewrite.instance },
  ]);
}
export function enforceSearchLimit(ip: string) {
  return enforceInOrder([
    { key: "search-text:ip:" + ip, ...RATE_LIMITS.searchText.ip },
    { key: "search-text:instance", ...RATE_LIMITS.searchText.instance },
  ]);
}

export async function enforceImageLimit(ip: string, deadline: UploadDeadline) {
  try {
    return await uploadTransaction(deadline, async (trx, run) => {
      const source = await run(() =>
        consumeRateLimit(
          { key: "images:ip:" + ip, ...RATE_LIMITS.images.ip },
          trx,
        ),
      );
      if (!source.allowed) return source;
      return run(() =>
        consumeRateLimit(
          { key: "images:instance", ...RATE_LIMITS.images.instance },
          trx,
        ),
      );
    });
  } catch (error) {
    if (error instanceof BodyError) throw error;
    log("rate-limit.unavailable", { sqlstate: sqlstate(error) }, "warn");
    return { allowed: true };
  }
}
