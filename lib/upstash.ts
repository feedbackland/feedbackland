import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const textEmbeddingRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5000, "1 d"), // 5000 requests per 1 day
  analytics: true,
  prefix: "textEmbeddingRateLimit",
});
