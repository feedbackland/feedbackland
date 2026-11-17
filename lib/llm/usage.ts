import "server-only";
import { requireLease, type Lease } from "../jobs/leases";
import { randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/schema";
import { DomainError } from "../domain-error";
import { isDeepStrictEqual } from "node:util";
import { deadline, withinTransaction, type Deadline } from "./deadline";
import { log } from "../log";
import type { Actor } from "../auth/authorization";
import {
  attemptAiBudget,
  consumeRateLimitWindow,
} from "../../queries/check-rate-limit";
import { AiError, DailyBudgetError, healthReason } from "./errors";
import {
  issueSequence,
  observeHealth,
  requireDispatch,
  authorizeCheckActor,
  type CheckTicket,
  type Identity,
  type Configuration,
} from "./settings-store";
import type { Capability, Feature } from "./constants";

type Tx = Transaction<DB>;
type RunOwner = {
  runId: string;
  owner: string;
  fence: string;
};
export type Reservation = RunOwner & { id: string; configToken: string };
export type Admission = Identity & {
  feature: Feature;
  capability: Capability;
  sequence: string | null;
  day: string;
  diagnostic: boolean;
  leaseEnd?: number;
};

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  cost?: unknown;
};
export function dailyShare(config: Configuration, feature: Feature) {
  return feature === "moderation"
    ? config.options.dailyCallLimit
    : Math.floor(config.options.dailyCallLimit * 0.8);
}
export async function admitMetadata(
  config: Configuration,
  actor?: Actor,
  check?: CheckTicket,
  wall = deadline(config.options.timeoutMs),
  kind = "key",
  lease?: Lease,
) {
  return withinTransaction(
    wall,
    async (trx) => {
      if (lease) await requireLease(trx, lease);
      const admin = check?.action?.actor ?? actor;
      const user = admin
        ? await authorizeCheckActor(trx, admin, !check)
        : undefined;
      const purpose = admin
        ? "admin"
        : check && kind === "key"
          ? "check"
          : "ordinary";
      await requireDispatch(trx, config, purpose, check);
      const instance = await consumeRateLimitWindow(
        { key: "ai:metadata:minute", limit: 60, windowSeconds: 60 },
        trx,
      );
      if (!instance.allowed) throw new AiError("provider-rate", 429);
      await requireDispatch(trx, config, purpose, check);
      const leaseEnd = lease ? await requireLease(trx, lease) : undefined;
      return { windows: user ? [user, instance] : [instance], leaseEnd };
    },
    (receipt) => cancelUndispatchedMetadata(receipt.windows),
  );
}
export async function cancelUndispatchedMetadata(
  windows: readonly { key: string; window: string }[],
) {
  try {
    await withinTransaction(deadline(2000), async (trx) => {
      for (const { key, window } of windows)
        await trx
          .updateTable("rate_limit")
          .where("key", "=", key)
          .where("windowStart", "=", sql<Date>`${window}::timestamptz`)
          .where("count", ">", 0)
          .set({ count: sql`count-1` })
          .execute();
    });
  } catch {
    log(
      "ai.admission-reversal-failed",
      { name: "metadata", stage: "accounting" },
      "warn",
    );
  }
}
// Recheck the database clock after acquiring the lease row lock. Use a monotonic
// deadline so a queued wire request cannot cross its reservation's UTC midnight.
async function requireInsightLease(trx: Tx, run: RunOwner, day?: string) {
  const end = await requireLease(trx, {
    name: "insight:" + run.runId,
    holder: run.owner,
    fence: run.fence,
  });
  if (!day) return end;
  const observed = performance.now();
  const {
    rows: [clock],
  } = await sql<{
    remaining: number;
  }>`select extract(epoch from (((${day}::date+1)::timestamp at time zone 'UTC')-clock_timestamp()))::float8*1000 as remaining`.execute(
    trx,
  );
  if (clock.remaining <= 0) throw new AiError("RESERVATION_EXPIRED");
  return Math.min(end, observed + clock.remaining);
}
export async function reserveInsightPlan(
  trx: Tx,
  config: Configuration,
  run: RunOwner,
  plan: { snapshot: string; groups: string[][] },
) {
  // Bind the request to repeatable input order before waiting for any locks.
  const input = {
    snapshot: plan.snapshot,
    groups: plan.groups.map((group) => [...group]),
  };
  const chunks = input.groups.length;
  const members = input.groups.flat();
  if (
    !input.snapshot ||
    input.snapshot.length > 128 ||
    !chunks ||
    members.length > 2000 ||
    input.groups.some((group) => !group.length || group.length > 200) ||
    members.some((id) => !id || id.length > 128) ||
    new Set(members).size !== members.length
  )
    throw new AiError("invalid-input");
  await issueSequence(trx, config, "chat", true);
  await requireInsightLease(trx, run);
  const record = await trx
    .selectFrom("insight_reports")
    .select(["stage", "reservationId", "requestPlan", "inputHash"])
    .where("id", "=", run.runId)
    .where("owner", "=", run.owner)
    .where("fence", "=", run.fence)
    .where("configToken", "=", config.token)
    .where("status", "=", "running")
    .forUpdate()
    .executeTakeFirst();
  const count = chunks + (chunks > 1 ? 1 : 0);
  if (!record || (record.inputHash && record.inputHash !== input.snapshot))
    throw new AiError("RESERVATION_EXPIRED");
  const frozen = { ...input, chunks, merge: chunks > 1 };
  if (
    record.requestPlan &&
    !isDeepStrictEqual(record.requestPlan, input) &&
    !isDeepStrictEqual(record.requestPlan, frozen)
  )
    throw new AiError("RESERVATION_EXPIRED");
  if (
    record.stage === "admitted" &&
    record.reservationId &&
    isDeepStrictEqual(record.requestPlan, frozen)
  ) {
    await requireInsightLease(trx, run);
    return { ...run, id: record.reservationId, configToken: config.token };
  }
  if (record.stage !== "admitting") throw new AiError("RESERVATION_EXPIRED");
  const budget = await attemptAiBudget(
    dailyShare(config, "insights"),
    count,
    trx,
  );
  if (!budget) throw new AiError("INSIGHT_PLAN_TOO_LARGE");
  if (!budget.allowed) throw new DailyBudgetError(budget);
  const day = budget.day;
  const id = randomUUID();
  await trx
    .updateTable("insight_reports")
    .where("id", "=", run.runId)
    .set({
      reservationId: id,
      reservationDay: day,
      reservationCount: count,
      stage: "admitted",
      requestPlan: frozen,
    })
    .execute();
  await requireInsightLease(trx, run);
  return { ...run, id, configToken: config.token };
}
async function spendReservation(
  trx: Tx,
  config: Configuration,
  r: Reservation,
) {
  await requireInsightLease(trx, r);
  const row = await trx
    .updateTable("insight_reports")
    .where("id", "=", r.runId)
    .where("reservationId", "=", r.id)
    .where("owner", "=", r.owner)
    .where("fence", "=", r.fence)
    .where("configToken", "=", config.token)
    .where("stage", "=", "admitted")
    .where("status", "=", "running")
    .where("reservationCount", ">", 0)
    .where(
      sql<boolean>`"reservationDay"=(clock_timestamp() at time zone 'UTC')::date`,
    )
    .set({ reservationCount: sql`"reservationCount"-1` })
    .returning(sql<string>`to_char("reservationDay",'YYYY-MM-DD')`.as("day"))
    .executeTakeFirst();
  if (!row) throw new AiError("RESERVATION_EXPIRED");
  return row.day;
}
export async function beginAttempt(
  config: Configuration,
  feature: Feature,
  capability: Capability,
  check?: CheckTicket,
  reservation?: Reservation,
  wall: Deadline = deadline(config.options.timeoutMs),
  lease?: Lease,
): Promise<Admission> {
  try {
    return await withinTransaction(
      wall,
      async (trx) => {
        if (lease) await requireLease(trx, lease);
        if (check && feature !== "check") throw new AiError("invalid-input");
        const action = check?.action;
        if (action) await authorizeCheckActor(trx, action.actor, false);
        const purpose = action
          ? "admin"
          : feature === "check" && check
            ? "check"
            : "ordinary";
        await requireDispatch(trx, config, purpose, check);
        if (
          (feature === "insights" && !reservation) ||
          (reservation && feature !== "insights")
        )
          throw new AiError("invalid-input");
        const sequence = await issueSequence(
          trx,
          config,
          capability,
          feature === "check" || feature === "probe",
        );
        let diagnostic = false;
        let day: string;
        if (reservation) {
          day = await spendReservation(trx, config, reservation);
        } else {
          let budget = await attemptAiBudget(
            dailyShare(config, feature),
            1,
            trx,
          );
          if (!budget?.allowed && action?.intent === "test-again") {
            budget = await attemptAiBudget(40, 1, trx, true);
            diagnostic = true;
          }
          if (!budget) throw new AiError("AI_PAUSED");
          if (!budget.allowed) throw new DailyBudgetError(budget);
          day = budget.day;
        }
        // If the worker dies after dispatch, retain an explicitly uncosted call.
        await trx
          .insertInto("llm_usage")
          .values({ day, feature, calls: 1, uncostedCalls: 1 })
          .onConflict((c) =>
            c.columns(["day", "feature"]).doUpdateSet({
              calls: sql`llm_usage.calls+1`,
              uncostedCalls: sql`llm_usage."uncostedCalls"+1`,
            }),
          )
          .execute();
        await requireDispatch(trx, config, purpose, check);
        const leaseEnd = reservation
          ? await requireInsightLease(trx, reservation, day)
          : lease
            ? await requireLease(trx, lease)
            : undefined;
        return {
          leaseEnd,
          token: config.token,
          revision: config.revision,
          feature,
          capability,
          day,
          sequence,
          diagnostic,
        };
      },
      (receipt) => cancelUndispatched(receipt, reservation),
    );
  } catch (error) {
    wall.signal.throwIfAborted();
    if (error instanceof DomainError) throw new AiError("forbidden", 403);
    throw error instanceof AiError ? error : new AiError("limiter-error");
  }
}
// Admission commits before network I/O. If cancellation or lease loss wins in
// that small interval, undo exactly this undispatched attempt on its own day.
export async function cancelUndispatched(
  admission: Admission,
  reservation?: Reservation,
) {
  try {
    await withinTransaction(deadline(2000), async (trx) => {
      if (reservation) {
        // A spent slot belongs to the still-live owner. Always correct the
        // ledger below, even when a fenced worker can no longer touch the run.
        await sql`with lease as materialized (
          select holder,fence,until from job_lease where name=${"insight:" + reservation.runId}
            and holder=${reservation.owner} and fence=${reservation.fence} for share
        ), active as materialized (
          select r.id,l.until from insight_reports r join lease l on l.holder=r.owner and l.fence=r.fence
          where r.id=${reservation.runId} and r."reservationId"=${reservation.id} and r."configToken"=${reservation.configToken}
            and r.status='running' and r.stage='admitted' and r."reservationDay"=${admission.day}::date for update of r
        ) update insight_reports r set "reservationCount"=r."reservationCount"+1 from active
          where active.id=r.id and active.until>clock_timestamp() and r."reservationDay"=(clock_timestamp() at time zone 'UTC')::date`.execute(
          trx,
        );
      } else {
        const prefix = admission.diagnostic
          ? "ai:instance:day:diagnostic:"
          : "ai:instance:day:";
        await trx
          .updateTable("rate_limit")
          .where("key", "=", prefix + admission.day)
          .where("count", ">", 0)
          .set({ count: sql`count-1` })
          .execute();
      }
      await trx
        .updateTable("llm_usage")
        .where("day", "=", sql<Date>`${admission.day}::date`)
        .where("feature", "=", admission.feature)
        .set({ calls: sql`calls-1`, uncostedCalls: sql`"uncostedCalls"-1` })
        .execute();
    });
  } catch {
    log(
      "ai.admission-reversal-failed",
      { name: admission.feature, stage: "accounting" },
      "warn",
    );
  }
}
function tokens(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}
function price(cost: unknown) {
  if (typeof cost !== "number" && typeof cost !== "string") return null;
  const str = String(cost);
  const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,16}))?(?:e-(\d{1,2}))?$/i.exec(
    str,
  );
  if (!match) return null;
  // NUMERIC(20,12) must represent the reported amount exactly. Never round
  // a positive microcharge down to a known zero.
  const fraction = match[2] ?? "",
    scale = fraction.length + Number(match[3] ?? 0);
  const digits = BigInt(match[1] + fraction);
  if (scale > 12 && digits % 10n ** BigInt(scale - 12) !== 0n) return null;
  return str;
}
export async function finishAttempt(
  admission: Admission,
  usage: Usage,
  error?: AiError,
) {
  const cost = price(usage.cost);
  try {
    await withinTransaction(deadline(1000), async (trx) => {
      // Match admission's lock order: configuration, health, then usage.
      const reason = error ? healthReason(error) : null;
      if (admission.sequence && (!error || reason))
        await observeHealth(
          admission,
          admission.capability,
          admission.sequence,
          reason,
          trx,
        );
      await trx
        .updateTable("llm_usage")
        .where("day", "=", sql<Date>`${admission.day}::date`)
        .where("feature", "=", admission.feature)
        .set({
          errors: sql`errors+${error ? 1 : 0}`,
          inputTokens: sql`"inputTokens"+${tokens(usage.inputTokens)}`,
          outputTokens: sql`"outputTokens"+${tokens(usage.outputTokens)}`,
          ...(cost === null
            ? {}
            : {
                costUsd: sql`case when "costUsd"+${cost}::numeric < 100000000 then "costUsd"+${cost}::numeric else "costUsd" end`,
                uncostedCalls: sql`"uncostedCalls"-case when "costUsd"+${cost}::numeric < 100000000 then 1 else 0 end`,
              }),
        })
        .execute();
    });
  } catch {
    // Admission already recorded this attempt as uncosted. Rolling back all
    // settlement writes preserves that record and the original provider result.
    log(
      "ai.settlement-failed",
      { name: admission.feature, stage: "accounting" },
      "warn",
    );
  }
}
