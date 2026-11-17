import "server-only";
import { sql } from "kysely";
import { contentTransaction } from "../../db/content-transaction";
import {
  configuration,
  failingCapability,
  type Configuration,
} from "./settings-store";
import { dailyShare } from "./usage";

export async function contentBudget(
  config: Configuration,
  feature: "moderation" | "rewrite",
  signal?: AbortSignal,
) {
  const result = await contentTransaction(signal, (trx) =>
    sql<{ now: Date; day: string; allowed: boolean }>`
    with instant as (select clock_timestamp() as at),
      today as (select at, to_char(at at time zone 'UTC','YYYY-MM-DD') as day from instant)
    select at as now, day, coalesce(r.count,0) < ${dailyShare(config, feature)} as allowed from today
    left join rate_limit r on r.key = 'ai:instance:day:' || day`.execute(trx),
  );
  return result.rows[0];
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
        (["invalid", "management", "expired"].includes(config.check.key) ||
          config.check.chat === "failed"))
    )
      return false;
    return (
      (await contentBudget(config, "rewrite", signal)).allowed &&
      !(await failingCapability(config, "chat", signal))
    );
  } catch {
    return false;
  }
}
