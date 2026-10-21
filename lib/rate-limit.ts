import "server-only";
import { checkRateLimit } from "@/queries/check-rate-limit";
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
export function enforceSearchLimit(ip: string) {
  return enforceInOrder([
    { key: "search-text:ip:" + ip, ...RATE_LIMITS.searchText.ip },
    { key: "search-text:instance", ...RATE_LIMITS.searchText.instance },
  ]);
}
