import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const inappropriateCheckRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, "1 h"), // 100 calls per hour
  analytics: true,
  prefix: "inappropriateCheckRateLimit",
});
