import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import type { DB } from "@/db/schema";
import { contentTransaction } from "@/db/content-transaction";
import { lock, locks } from "@/db/locks";
import { requireAdmin, type Actor } from "@/lib/auth/authorization";
import { DomainError } from "@/lib/domain-error";
import { insightFailure } from "@/lib/insight-run";
import {
  AiError,
  DailyBudgetError,
  UnavailableCapability,
} from "@/lib/llm/errors";
import {
  insightConfiguration,
  requireDispatch,
} from "@/lib/llm/settings-store";
import { reserveInsightPlan } from "@/lib/llm/usage";
import { log, sqlstate } from "@/lib/log";
import { expireInsights } from "@/queries/expire-insights";
import { getInsightsInputs } from "@/queries/get-insights-inputs";
import { saveInsightsQuery } from "@/queries/save-insights";
import { analyseInsights, insightChunks } from "./insight-analysis";
import {
  claimInsightLease,
  monitorLease,
  requireLease,
  type Lease,
} from "./leases";

const fields = [
  "id",
  "status",
  "stage",
  "startedAt",
  "finishedAt",
  "error",
  "postsTotal",
  "postsAnalyzed",
] as const;
function publicRun(row: {
  id: string;
  status: string;
  stage: string;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
  postsTotal: string;
  postsAnalyzed: string;
}) {
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    error: row.error ? insightFailure(row.error) : null,
    postsTotal: Number(row.postsTotal),
    postsAnalyzed: Number(row.postsAnalyzed),
  };
}
export async function getInsightsRun(
  actor: Actor,
  id?: string,
  signal?: AbortSignal,
) {
  return contentTransaction(signal, async (trx) => {
    await requireAdmin(trx, actor, true);
    await expireInsights(trx);
    let query = trx.selectFrom("insight_reports").select(fields);
    if (id) query = query.where("id", "=", id);
    const row = await query.orderBy("id", "desc").limit(1).executeTakeFirst();
    return row ? publicRun(row) : null;
  });
}

async function createRun(trx: Transaction<DB>, actor: Actor) {
  await requireAdmin(trx, actor, true);
  await lock(trx, locks.insights);
  await expireInsights(trx);
  const existing = await trx
    .selectFrom("insight_reports")
    .select(fields)
    .where("status", "=", "running")
    .executeTakeFirst();
  if (existing) return { run: publicRun(existing) } as const;
  const config = await insightConfiguration(trx);
  const { snapshot, total } = await getInsightsInputs(trx);
  if (!snapshot.posts.length)
    throw new DomainError("PRECONDITION_FAILED", "NO_OPEN_FEEDBACK");
  const input = JSON.stringify(snapshot),
    hash = createHash("sha256").update(input).digest("hex");
  const owner = randomUUID();
  const row = await trx
    .insertInto("insight_reports")
    .values({
      status: "running",
      stage: "admitting",
      configToken: config.token,
      owner,
      fence: "1",
      model: config.options.model,
      inputSnapshot: sql`${input}::jsonb`,
      inputHash: hash,
      postsTotal: String(total),
      postsAnalyzed: String(snapshot.posts.length),
    })
    .returning(fields)
    .executeTakeFirstOrThrow();
  const claim = await claimInsightLease(trx, row.id, owner);
  await requireAdmin(trx, actor);
  return { run: publicRun(row), claim, config, snapshot, hash } as const;
}

function reportError(error: unknown) {
  if (error instanceof DomainError) return error;
  const reason = insightFailure(error instanceof AiError ? error.reason : null);
  if (error instanceof DailyBudgetError)
    return new DomainError(
      "TOO_MANY_REQUESTS",
      "AI_PAUSED",
      error.retryAfterSeconds,
      error.resetsAt,
    );
  if (
    error instanceof UnavailableCapability ||
    reason === "key-unreadable" ||
    reason === "provider-auth"
  )
    return new DomainError(
      "SERVICE_UNAVAILABLE",
      "AI_UNAVAILABLE",
      undefined,
      undefined,
      insightFailure(
        error instanceof UnavailableCapability
          ? (error.lastReason ?? "AI_UNAVAILABLE")
          : reason,
      ),
    );
  return new DomainError(
    reason === "AI_NOT_CONFIGURED"
      ? "PRECONDITION_FAILED"
      : "SERVICE_UNAVAILABLE",
    reason,
  );
}
async function failRun(id: string, lease: Lease, error: unknown) {
  const reason = insightFailure(error instanceof AiError ? error.reason : null);
  try {
    await contentTransaction(undefined, async (trx) => {
      await requireLease(trx, lease);
      await trx
        .updateTable("insight_reports")
        .where("id", "=", id)
        .where("status", "=", "running")
        .where("owner", "=", lease.holder)
        .where("fence", "=", lease.fence)
        .set({
          status: "failed",
          stage: "complete",
          error: reason,
          finishedAt: sql`clock_timestamp()`,
          inputSnapshot: null,
          requestPlan: null,
        })
        .execute();
      await requireLease(trx, lease);
    });
  } catch (cause) {
    // A fenced-out worker leaves its row to the stale-run sweeper.
    log(
      "insights.failure-deferred",
      { name: "insights", sqlstate: sqlstate(cause) },
      "warn",
    );
  }
}

export async function startInsightsRun(actor: Actor, signal?: AbortSignal) {
  const created = await contentTransaction(signal, (trx) =>
    createRun(trx, actor),
  ).catch((error) => {
    throw reportError(error);
  });
  if (!created.claim) return created.run;
  const { run, claim, config, snapshot, hash } = created;
  const owner = monitorLease(claim.lease, claim.expires, run.id);
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  const workSignal = AbortSignal.any([owner.signal, shutdown.signal]);
  const finish = async () => {
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
    await owner
      .release()
      .catch((error) =>
        log("insights.release-deferred", { sqlstate: sqlstate(error) }, "warn"),
      );
  };
  try {
    const chunks = insightChunks(snapshot.posts);
    const reservation = await contentTransaction(workSignal, async (trx) => {
      await requireAdmin(trx, actor, true);
      await requireDispatch(trx, config, "ordinary");
      return reserveInsightPlan(
        trx,
        config,
        { runId: run.id, owner: claim.lease.holder, fence: claim.lease.fence },
        {
          snapshot: hash,
          groups: chunks.map((group) => group.map((post) => post.id)),
        },
      );
    });
    // From this point the process owns the job independently of the HTTP request.
    void (async () => {
      try {
        const insights = await analyseInsights(
          snapshot,
          chunks,
          reservation,
          workSignal,
        );
        await saveInsightsQuery(reservation, config, insights, workSignal);
      } catch (error) {
        await failRun(run.id, claim.lease, error);
      } finally {
        await finish();
      }
    })();
    return { ...run, stage: "admitted" };
  } catch (error) {
    await failRun(run.id, claim.lease, error);
    await finish();
    throw reportError(error);
  }
}
