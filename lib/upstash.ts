import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const textEmbeddingRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, "60 s"), // max. 100 calls per 60 seconds
  analytics: true,
  prefix: "textEmbeddingRateLimit",
});
