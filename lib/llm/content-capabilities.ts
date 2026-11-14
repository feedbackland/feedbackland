import "server-only";
import { sql } from "kysely";
import { db } from "../../db/db";
import {
  configuration,
  failingCapability,
  type Configuration,
} from "./settings-store";
import { dailyShare } from "./usage";

export async function hasBudget(
  config: Configuration,
  feature: "moderation" | "rewrite",
  signal?: AbortSignal,
) {
  const row = await db
    .selectFrom("rate_limit")
    .select("count")
    .where(
      "key",
      "=",
      sql<string>`'ai:instance:day:' || to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')`,
    )
    .executeTakeFirst({ signal });
  return (row?.count ?? 0) < dailyShare(config, feature);
}
export async function canImproveDraft() {
  try {
    // Public settings must remain available if optional AI reads stall.
    const signal = AbortSignal.timeout(1500);
    const config = await configuration(signal);
    if (
      !config.valid ||
      config.diverged ||
      !config.configured ||
      !config.apiKey ||
      (config.check &&
        ["invalid", "management", "expired"].includes(config.check.key))
    )
      return false;
    return (
      (await hasBudget(config, "rewrite", signal)) &&
      !(await failingCapability(config, "chat", signal))
    );
  } catch {
    return false;
  }
}
