import "server-only";
import type { Kysely, Selectable, Transaction } from "kysely";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getConfig } from "../config";
import { runtimeState } from "../runtime-state";
import { log } from "../log";
import { openSecret, sealSecret } from "../secret-box";
import { lock, locks } from "../../db/locks";
import { requireAdmin, type Actor } from "../auth/authorization";
import { defaults, optionsSchema, keySchema, type Options } from "./defaults";
import { AiError, type Reason } from "./errors";
import type { Capability } from "./constants";
import type { DB, AiSettings } from "../../db/schema";
import { sql } from "kysely";
import { db } from "../../db/db";
export async function ensureAiSettingsRow(trx: Kysely<DB>) {
  await trx
    .insertInto("ai_settings")
    .values({ id: 1 })
    .onConflict((conflict) => conflict.column("id").doNothing())
    .execute();
}
type Row = Selectable<AiSettings>;
export type Identity = { token: string; revision: string };
const purpose = "ai_settings.apiKey";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const checkSchema = z
  .object({
    key: z.enum(["valid", "invalid", "management", "expired", "unknown"]),
    chat: z.enum(["passed", "failed", "untested"]),
    search: z.enum(["passed", "failed", "untested"]),
  })
  .strict();
type Check = z.infer<typeof checkSchema>;
function checkedResult(input: unknown): Check {
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) throw new AiError("invalid-input");
  return parsed.data;
}
const recordedCheck = checkSchema.extend({
  at: z.string(),
  configToken: z.string(),
});
function resolve(row: Row, secret: string) {
  const { llm, dimensions: requestedDimensions } = getConfig();
  const dimensions = runtimeState().vector?.dimensions ?? requestedDimensions;
  const saved = optionsSchema.safeParse(row.options);
  if (!saved.success) throw new AiError("AI_UNAVAILABLE");
  const options = { ...defaults, ...saved.data } as Options;
  for (const key of Object.keys(llm.options) as (keyof Options)[]) {
    const value = llm.options[key];
    if (value !== undefined) Object.assign(options, { [key]: value });
  }
  if (saved.data.vision === undefined)
    options.vision = options.model === defaults.model;
  const keyDigest = llm.apiKey ? digest(llm.apiKey) : row.apiKeyDigest;
  const apiKey =
    llm.apiKey ?? (row.apiKey ? openSecret(row.apiKey, secret, purpose) : null);
  const unreadable =
    !llm.apiKey && !!row.apiKey && (!apiKey || digest(apiKey) !== keyDigest);
  if (unreadable && runtimeState().unreadableAiKey !== row.apiKey) {
    runtimeState().unreadableAiKey = row.apiKey!;
    log("ai.stored-key-unreadable", {}, "warn");
  }
  const configured =
    row.enabled !== false &&
    (!!llm.apiKey || (row.enabled === true && !!row.apiKey));
  const token = digest(
    JSON.stringify([
      row.revision,
      row.enabled,
      configured,
      keyDigest,
      row.indexEpoch,
      requestedDimensions,
      dimensions,
      ...(Object.keys(defaults) as (keyof Options)[]).map((k) => options[k]),
    ]),
  );
  const checked = recordedCheck.safeParse(row.lastCheck);
  const check =
    checked.success && checked.data.configToken === token ? checked.data : null;
  return {
    token,
    revision: row.revision,
    configured,
    options,
    dimensions,
    widthMismatch: dimensions !== requestedDimensions,
    apiKey: unreadable ? null : apiKey,
    keyDigest,
    unreadable,
    check,
    enabled: row.enabled,
    indexEpoch: row.indexEpoch,
    diverged: row.effectiveConfigToken !== token,
  };
}
export type Configuration = ReturnType<typeof resolve>;
const clearResults = {
  creditWaitUntil: null,
  creditWaitConfigToken: null,
  lastCheck: null,
};
const currentRow = (connection: Kysely<DB>) =>
  connection.selectFrom("ai_settings").where("id", "=", 1).selectAll();
export async function synchronizeAiEnvironment(
  trx: Transaction<DB>,
  secret: string,
) {
  const row = await currentRow(trx).forUpdate().executeTakeFirstOrThrow();
  const config = resolve(row, secret);
  if (!config.diverged) return true;
  // Active replicas renew their lease. A stopped cohort can rotate the
  // environment after the last lease expires without overwriting a live peer.
  const live = await trx
    .selectFrom("job_lease")
    .select("name")
    .where("name", "like", "ai-config:%")
    .where("until", ">", sql<Date>`clock_timestamp()`)
    .executeTakeFirst();
  if (row.effectiveConfigToken && live) return false;
  await trx
    .updateTable("ai_settings")
    .where("id", "=", 1)
    .set({ effectiveConfigToken: config.token, ...clearResults })
    .execute();
  return true;
}
export async function renewConfigurationLease(
  trx: Transaction<DB>,
  id: string,
) {
  const expires = sql<Date>`clock_timestamp()+interval '20 seconds'`;
  await trx
    .insertInto("job_lease")
    .values({ name: "ai-config:" + id, holder: id, until: expires, fence: 1 })
    .onConflict((c) => c.column("name").doUpdateSet({ until: expires }))
    .execute();
  await trx
    .deleteFrom("job_lease")
    .where("name", "like", "ai-config:%")
    .where("until", "<=", sql<Date>`clock_timestamp()`)
    .execute();
}
export function replicaId() {
  return (runtimeState().aiReplicaId ??= randomUUID());
}
export function startConfigurationLease() {
  const state = runtimeState();
  if (state.aiLeaseTimer) return;
  const tick = async () => {
    try {
      await db.transaction().execute(async (trx) => {
        if (await synchronizeAiEnvironment(trx, getConfig().authSecret))
          await renewConfigurationLease(trx, replicaId());
      });
    } catch {
      log("ai.configuration-refresh-failed", {}, "warn");
    } finally {
      state.aiLeaseTimer = setTimeout(tick, 5000);
      state.aiLeaseTimer.unref();
    }
  };
  state.aiLeaseTimer = setTimeout(tick, 5000);
  state.aiLeaseTimer.unref();
}
export async function configuration(): Promise<Configuration> {
  const state = runtimeState();
  if (state.aiConfig && performance.now() < state.aiConfig.until)
    return state.aiConfig.value;
  const generation = state.aiConfigGeneration,
    started = performance.now();
  const row = await currentRow(db).executeTakeFirst();
  if (!row) throw new AiError("AI_NOT_CONFIGURED");
  const value = resolve(row, getConfig().authSecret);
  if (generation === state.aiConfigGeneration)
    state.aiConfig = { value, until: started + 5000 };
  return value;
}
function invalidate() {
  const state = runtimeState();
  state.aiConfigGeneration = (state.aiConfigGeneration ?? 0) + 1;
  delete state.aiConfig;
}
function matches(row: Row, identity: Identity) {
  return (
    row.effectiveConfigToken === identity.token &&
    row.revision === identity.revision
  );
}
const rowFence = (trx: Kysely<DB>, id: Identity) =>
  trx
    .selectFrom("ai_settings")
    .where("id", "=", 1)
    .where("effectiveConfigToken", "=", id.token)
    .where("revision", "=", id.revision);
async function replaceToken(trx: Transaction<DB>, row: Row, check?: Check) {
  const value = resolve(row, getConfig().authSecret);
  await trx
    .updateTable("ai_settings")
    .set({
      effectiveConfigToken: value.token,
      ...clearResults,
      lastCheck: check
        ? { ...check, at: new Date().toISOString(), configToken: value.token }
        : null,
    })
    .where("id", "=", 1)
    .execute();
  return { token: value.token, revision: value.revision };
}
export async function saveConfiguration(
  actor: Actor,
  identity: Identity,
  change: {
    enabled?: boolean | null;
    apiKey?: string | null;
    options?: Partial<Options>;
  },
) {
  const result = await db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, actor);
    const row = await currentRow(trx).forUpdate().executeTakeFirstOrThrow();
    const before = resolve(row, getConfig().authSecret);
    if (!matches(row, identity) || before.diverged)
      throw new AiError("STALE_CONFIGURATION");
    const env = getConfig().llm;
    if (
      (change.apiKey !== undefined && env.apiKey) ||
      Object.keys(change.options ?? {}).some(
        (k) => env.options[k as keyof Options] !== undefined,
      )
    )
      throw new AiError("invalid-input");
    const options = optionsSchema.safeParse({
      ...(row.options as Partial<Options>),
      ...change.options,
    });
    if (
      !options.success ||
      (change.apiKey != null && !keySchema.safeParse(change.apiKey).success)
    )
      throw new AiError("invalid-input");
    const key = change.apiKey;
    if (
      change.enabled === true &&
      !(env.apiKey || (key === undefined ? before.apiKey : key))
    )
      throw new AiError("key-unreadable");
    // A replacement key must pass its own check before enabling stored-key AI.
    const enabled =
      change.enabled !== undefined
        ? change.enabled
        : key === null
          ? null
          : key && digest(key) !== before.keyDigest && before.enabled !== false
            ? null
            : before.enabled;
    if (change.enabled === true && key && digest(key) !== before.keyDigest)
      throw new AiError("STALE_CONFIGURATION");
    const updated = await trx
      .updateTable("ai_settings")
      .where("id", "=", 1)
      .set({
        ...(key === undefined
          ? {}
          : {
              apiKey: key
                ? sealSecret(key, getConfig().authSecret, purpose)
                : null,
              apiKeyDigest: key ? digest(key) : null,
              apiKeyLast4: key ? key.slice(-4) : null,
              apiKeySetAt: key ? sql<Date>`clock_timestamp()` : null,
            }),
        enabled,
        ...(change.enabled === false
          ? { keepOffAt: sql<Date>`clock_timestamp()`, keepOffBy: actor.userId }
          : enabled !== false
            ? { keepOffAt: null, keepOffBy: null }
            : {}),
        options: options.data,
        revision: sql`revision+1`,
        updatedBy: actor.userId,
        updatedAt: sql`clock_timestamp()`,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const after = resolve(updated, getConfig().authSecret);
    let transfer: Check | undefined;
    if (before.enabled !== true && updated.enabled === true) {
      if (
        before.check?.key !== "valid" ||
        before.check.chat !== "passed" ||
        before.keyDigest !== after.keyDigest ||
        before.options.model !== after.options.model ||
        before.options.privacy !== after.options.privacy ||
        before.options.vision !== after.options.vision
      )
        throw new AiError("STALE_CONFIGURATION");
      transfer = {
        key: "valid",
        chat: "passed",
        search:
          before.options.embeddingModel === after.options.embeddingModel &&
          before.indexEpoch === after.indexEpoch &&
          before.dimensions === after.dimensions
            ? before.check.search
            : "untested",
      };
    }
    return replaceToken(trx, updated, transfer);
  });
  invalidate();
  return result;
}
export async function saveCheck(identity: Identity, result: Check) {
  const value = checkedResult(result);
  const updated = await db
    .updateTable("ai_settings")
    .where("id", "=", 1)
    .where("revision", "=", identity.revision)
    .where("effectiveConfigToken", "=", identity.token)
    .set({
      lastCheck: {
        ...value,
        configToken: identity.token,
        at: new Date().toISOString(),
      },
    })
    .executeTakeFirst();
  invalidate();
  return updated.numUpdatedRows === 1n;
}
export async function beginCreditWait(identity: Identity) {
  const config = await configuration();
  if (
    config.diverged ||
    config.token !== identity.token ||
    config.revision !== identity.revision ||
    !config.apiKey ||
    getConfig().llm.apiKey
  )
    return null;
  const updated = await db
    .updateTable("ai_settings")
    .where("id", "=", 1)
    .where("revision", "=", identity.revision)
    .where("effectiveConfigToken", "=", identity.token)
    .where("enabled", "is", null)
    .where("apiKeyDigest", "is not", null)
    .where(sql<boolean>`"apiKeySetAt"+interval '7 days'>clock_timestamp()`)
    .set({
      creditWaitConfigToken: identity.token,
      creditWaitUntil: sql`date_trunc('milliseconds',"apiKeySetAt")+interval '7 days'`,
    })
    .returning("creditWaitUntil")
    .executeTakeFirst();
  return updated?.creditWaitUntil ?? null;
}
export async function completeCreditWait(
  identity: Identity,
  keyDigest: string,
  until: Date,
  result: Check,
) {
  const check = checkedResult(result);
  if (check.key !== "valid" || check.chat !== "passed") return null;
  const enabled = await db.transaction().execute(async (trx) => {
    const row = await currentRow(trx).forUpdate().executeTakeFirstOrThrow();
    const config = resolve(row, getConfig().authSecret);
    if (
      !matches(row, identity) ||
      config.diverged ||
      !config.apiKey ||
      getConfig().llm.apiKey ||
      config.keyDigest !== keyDigest
    )
      return null;
    const next = await trx
      .updateTable("ai_settings")
      .where("id", "=", 1)
      .where("enabled", "is", null)
      .where("apiKeyDigest", "=", keyDigest)
      .where("creditWaitConfigToken", "=", identity.token)
      .where("creditWaitUntil", "=", until)
      .where("creditWaitUntil", ">", sql<Date>`clock_timestamp()`)
      .set({
        enabled: true,
        revision: sql`revision+1`,
        updatedAt: sql`clock_timestamp()`,
        keepOffAt: null,
        keepOffBy: null,
      })
      .returningAll()
      .executeTakeFirst();
    return next ? replaceToken(trx, next, check) : null;
  });
  invalidate();
  return enabled;
}

export async function issueSequence(
  trx: Transaction<DB>,
  id: Identity,
  capability: Capability,
  checkOnly: boolean,
) {
  if (!(await rowFence(trx, id).select("id").forShare().executeTakeFirst()))
    throw new AiError("STALE_CONFIGURATION");
  if (checkOnly) return null;
  const h = await trx
    .insertInto("ai_health")
    .values({ configToken: id.token, capability, nextSequence: 1 })
    .onConflict((c) =>
      c.columns(["configToken", "capability"]).doUpdateSet({
        nextSequence: sql`ai_health."nextSequence"+1`,
        updatedAt: sql`clock_timestamp()`,
      }),
    )
    .returning("nextSequence")
    .executeTakeFirstOrThrow();
  return h.nextSequence;
}
export async function observeHealth(
  id: Identity,
  capability: Capability,
  sequence: string,
  reason: Reason | null,
) {
  await db.transaction().execute(async (trx) => {
    if (!(await rowFence(trx, id).select("id").forShare().executeTakeFirst()))
      return;
    const now = sql<Date>`clock_timestamp()`;
    await trx
      .updateTable("ai_health")
      .where("configToken", "=", id.token)
      .where("capability", "=", capability)
      .where("lastAppliedSequence", "<", sequence)
      .set({
        lastAppliedSequence: sequence,
        updatedAt: now,
        ...(reason === null
          ? { lastSuccessAt: now, failingSince: null, lastReason: null }
          : {
              lastFailureAt: now,
              lastReason: reason,
              failingSince: sql`coalesce("failingSince",clock_timestamp())`,
              failuresLastHour: sql`case when "failureWindowStart" > clock_timestamp()-interval '1 hour' then least(1000000,"failuresLastHour"+1) else 1 end`,
              failureWindowStart: sql`case when "failureWindowStart" > clock_timestamp()-interval '1 hour' then "failureWindowStart" else clock_timestamp() end`,
            }),
      })
      .execute();
  });
}
export async function failingCapability(id: Identity, capability: Capability) {
  return !!(await db
    .selectFrom("ai_health")
    .select("capability")
    .where("configToken", "=", id.token)
    .where("capability", "=", capability)
    .where(
      "failingSince",
      "<",
      sql<Date>`clock_timestamp()-interval '15 minutes'`,
    )
    .where(
      "lastFailureAt",
      ">",
      sql<Date>`clock_timestamp()-interval '10 minutes'`,
    )
    .executeTakeFirst());
}

export async function sweepHealth() {
  let count: number;
  do {
    count = await db.transaction().execute(async (trx) => {
      await sql`set local statement_timeout='5s'`.execute(trx);
      const acquired = await sql<{
        ok: boolean;
      }>`select pg_try_advisory_xact_lock(4702111234474983746) as ok`.execute(
        trx,
      );
      if (!acquired.rows[0].ok) return 0;
      return (
        await sql`delete from ai_health where ctid in (select ctid from ai_health where "updatedAt"<now()-interval '24 hours' and "configToken" is distinct from (select "effectiveConfigToken" from ai_settings where id=1) limit 1000 for update skip locked) returning 1`.execute(
          trx,
        )
      ).rows.length;
    });
  } while (count === 1000);
}
