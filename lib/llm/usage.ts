import "server-only";
import { randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import { db } from "../../db/db";
import type { DB } from "../../db/schema";
import { DomainError } from "../domain-error";
import { requireAdmin, type Actor } from "../auth/authorization";
import { lock, locks } from "../../db/locks";
import {
  consumeAiBudget,
  consumeRateLimit,
} from "../../queries/check-rate-limit";
import { AiError, healthReason } from "./errors";
import {
  issueSequence,
  observeHealth,
  type Identity,
  type Configuration,
} from "./settings-store";
import type { Capability, Feature } from "./constants";

type Tx = Transaction<DB>;
export type Reservation = {
  runId: string;
  owner: string;
  fence: string;
  id: string;
};
export type Admission = Identity & {
  feature: Feature;
  capability: Capability;
  sequence: string | null;
  day: string;
  diagnostic: boolean;
};
export type CheckAction = { actor: Actor; intent: "test-again" | "configure" };
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
const ordinaryCheck = { limit: 10, windowSeconds: 60 };
async function authorizeCheck(trx: Tx, actor: Actor) {
  await lock(trx, locks.membership);
  await requireAdmin(trx, actor);
  if (
    !(
      await consumeRateLimit(
        { key: "ai-check:user:" + actor.userId, ...ordinaryCheck },
        trx,
      )
    ).allowed
  )
    throw new AiError("provider-rate", 429);
}
export async function admitMetadata(config: Configuration, actor?: Actor) {
  await db.transaction().execute(async (trx) => {
    if (actor) await authorizeCheck(trx, actor);
    await issueSequence(trx, config, "chat", true);
    if (
      !(
        await consumeRateLimit(
          { key: "ai:metadata:minute", limit: 60, windowSeconds: 60 },
          trx,
        )
      ).allowed
    )
      throw new AiError("provider-rate", 429);
  });
}
// P10 can bind its frozen chunk plan and this reservation in the same short
// transaction. No credit is returned for abandoned or expired work.
async function requireInsightLease(trx: Tx, run: Omit<Reservation, "id">) {
  const lease = await trx
    .selectFrom("job_lease")
    .select("name")
    .where("name", "=", "insight:" + run.runId)
    .where("holder", "=", run.owner)
    .where("fence", "=", run.fence)
    .where("until", ">", sql<Date>`clock_timestamp()`)
    .forShare()
    .executeTakeFirst();
  if (!lease) throw new AiError("RESERVATION_EXPIRED");
}
export async function reserveInsightPlan(
  trx: Tx,
  config: Configuration,
  run: Omit<Reservation, "id">,
  chunks: number,
) {
  if (!Number.isSafeInteger(chunks) || chunks < 1 || chunks > 2000)
    throw new AiError("invalid-input");
  await issueSequence(trx, config, "chat", true);
  await requireInsightLease(trx, run);
  const record = await trx
    .selectFrom("insight_reports")
    .select(["stage", "reservationId", "requestPlan"])
    .where("id", "=", run.runId)
    .where("owner", "=", run.owner)
    .where("fence", "=", run.fence)
    .where("configToken", "=", config.token)
    .where("status", "=", "running")
    .forUpdate()
    .executeTakeFirst();
  const count = chunks + (chunks > 1 ? 1 : 0);
  if (!record) throw new AiError("RESERVATION_EXPIRED");
  if (
    record.stage === "admitted" &&
    record.reservationId &&
    (record.requestPlan as { chunks?: number })?.chunks === chunks
  )
    return { ...run, id: record.reservationId };
  if (record.stage !== "admitting") throw new AiError("RESERVATION_EXPIRED");
  const day = await consumeAiBudget(dailyShare(config, "insights"), count, trx);
  if (!day) throw new AiError("AI_PAUSED");
  const id = randomUUID();
  await trx
    .updateTable("insight_reports")
    .where("id", "=", run.runId)
    .set({
      reservationId: id,
      reservationDay: day,
      reservationCount: count,
      stage: "admitted",
      requestPlan: { chunks, merge: chunks > 1 },
    })
    .execute();
  return { ...run, id };
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
  action?: CheckAction,
  reservation?: Reservation,
): Promise<Admission> {
  try {
    return await db.transaction().execute(async (trx) => {
      if (action) {
        if (feature !== "check") throw new AiError("invalid-input");
        await authorizeCheck(trx, action.actor);
      }
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
      let day = reservation
        ? await spendReservation(trx, config, reservation)
        : await consumeAiBudget(dailyShare(config, feature), 1, trx);
      let diagnostic = false;
      if (!day && action?.intent === "test-again") {
        day = await consumeAiBudget(40, 1, trx, true);
        diagnostic = !!day;
      }
      if (!day) throw new AiError("AI_PAUSED");
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
      return {
        token: config.token,
        revision: config.revision,
        feature,
        capability,
        day,
        sequence,
        diagnostic,
      };
    });
  } catch (error) {
    if (error instanceof DomainError) throw new AiError("forbidden", 403);
    throw error instanceof AiError ? error : new AiError("limiter-error");
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
  await db
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
  const reason = error ? healthReason(error) : null;
  if (admission.sequence && (!error || reason))
    await observeHealth(
      admission,
      admission.capability,
      admission.sequence,
      reason,
    );
}
