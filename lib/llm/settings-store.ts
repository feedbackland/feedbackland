import "server-only";
import type { Kysely, Selectable, Transaction } from "kysely";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getConfig } from "../config";
import { runtimeState } from "../runtime-state";
import { log } from "../log";
import { DomainError } from "../domain-error";
import { openSecret, sealSecret } from "../secret-box";
import { lock, locks } from "../../db/locks";
import { requireAdmin, type Actor } from "../auth/authorization";
import { defaults, optionsSchema, keySchema, type Options } from "./defaults";
import { AiError, type Reason } from "./errors";
import type { Capability } from "./constants";
import type { DB, AiSettings } from "../../db/schema";
import { sql } from "kysely";
import { db } from "../../db/db";
import { consumeRateLimitWindow } from "../../queries/check-rate-limit";
import { deadline, withinTransaction, type Deadline } from "./deadline";
export async function ensureAiSettingsRow(trx: Kysely<DB>) {
  await trx
    .insertInto("ai_settings")
    .values({ id: 1 })
    .onConflict((conflict) => conflict.column("id").doNothing())
    .execute();
}
type Row = Selectable<AiSettings>;
export type Identity = { token: string; revision: string };
export type CheckAction = { actor: Actor; intent: "test-again" | "configure" };
export type CheckTicket = Identity & {
  sequence: string;
  action?: CheckAction;
  creditWait: boolean;
};
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
  sequence: z.string().optional(),
});
function resolve(row: Row, secret: string) {
  const {
    llm,
    dimensions: requestedDimensions,
    explicitDimensions,
  } = getConfig();
  const dimensions = runtimeState().vector?.dimensions ?? requestedDimensions;
  const saved = optionsSchema.safeParse(row.options);
  const valid = llm.valid && saved.success;
  const stored = saved.data ?? {};
  const options = { ...defaults, ...stored } as Options;
  for (const key of Object.keys(llm.options) as (keyof Options)[]) {
    const value = llm.options[key];
    if (value !== undefined) Object.assign(options, { [key]: value });
  }
  if (stored.vision === undefined)
    options.vision =
      row.catalogueModel === options.model && row.catalogueVision !== null
        ? row.catalogueVision
        : options.model === defaults.model;
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
    valid &&
    row.enabled !== false &&
    (!!llm.apiKey || (row.enabled === true && !!row.apiKey));
  const token = digest(
    JSON.stringify([
      row.configGeneration,
      row.revision,
      valid,
      row.enabled,
      configured,
      keyDigest,
      row.indexEpoch,
      explicitDimensions ? requestedDimensions : dimensions,
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
    valid,
    widthMismatch: explicitDimensions && dimensions !== requestedDimensions,
    apiKey: unreadable ? null : apiKey,
    keyDigest,
    unreadable,
    check,
    enabled: row.enabled,
    indexEpoch: row.indexEpoch,
    activeToken: row.effectiveConfigToken,
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
// A published revision must reflect the configuration used to screen it,
// including a keyless preflight on another replica.
export async function lockContentConfiguration(
  trx: Transaction<DB>,
  expected: Configuration,
) {
  const row = await currentRow(trx).forShare().executeTakeFirstOrThrow();
  if (
    row.effectiveConfigToken !== expected.activeToken ||
    resolve(row, getConfig().authSecret).token !== expected.token
  )
    throw new DomainError("CONFLICT", "CONTENT_SETTINGS_CHANGED");
}
export async function synchronizeAiEnvironment(
  trx: Transaction<DB>,
  secret: string,
) {
  const row = await currentRow(trx).forUpdate().executeTakeFirstOrThrow();
  const config = resolve(row, secret);
  if (!config.diverged) return config.valid;
  if (!config.valid) return false;
  // Active replicas renew their lease. A stopped cohort can rotate the
  // environment after the last lease expires without overwriting a live peer.
  const live = await trx
    .selectFrom("job_lease")
    .select("name")
    .where("name", "like", "ai-config:%")
    .where("until", ">", sql<Date>`clock_timestamp()`)
    .executeTakeFirst();
  if (row.effectiveConfigToken && live) return false;
  const updated = await trx
    .updateTable("ai_settings")
    .where("id", "=", 1)
    .set({ configGeneration: sql`"configGeneration"+1` })
    .returningAll()
    .executeTakeFirstOrThrow();
  await replaceToken(trx, updated, undefined, secret);
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
// A running process may renew a matching configuration. Only boot may adopt one.
export async function refreshConfigurationLease(
  trx: Transaction<DB>,
  secret: string,
  id: string,
) {
  const row = await currentRow(trx).forShare().executeTakeFirstOrThrow();
  const config = resolve(row, secret);
  if (config.diverged || !config.valid) return false;
  await renewConfigurationLease(trx, id);
  return true;
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
        await refreshConfigurationLease(
          trx,
          getConfig().authSecret,
          replicaId(),
        );
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
export async function configuration(
  signal?: AbortSignal,
): Promise<Configuration> {
  const state = runtimeState();
  if (state.aiConfig && performance.now() < state.aiConfig.until)
    return state.aiConfig.value;
  const generation = state.aiConfigGeneration,
    started = performance.now();
  const row = await currentRow(db).executeTakeFirst({ signal });
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
async function replaceToken(
  trx: Transaction<DB>,
  row: Row,
  check?: Check,
  secret = getConfig().authSecret,
) {
  const value = resolve(row, secret);
  await trx
    .updateTable("ai_settings")
    .set({
      effectiveConfigToken: value.token,
      ...clearResults,
      lastCheck: check
        ? {
            ...check,
            at: new Date().toISOString(),
            configToken: value.token,
            sequence: row.checkSequence,
          }
        : null,
    })
    .where("id", "=", 1)
    .execute();
  return { token: value.token, revision: value.revision };
}
// Catalogue evidence is bound to the configuration which made the request.
export async function recordModelVision(
  config: Configuration,
  models: readonly { id: string; vision: boolean | null }[],
  wall: Deadline,
) {
  const model = models.find((m) => m.id === config.options.model);
  if (!model) return;
  await withinTransaction(wall, async (trx) => {
    const row = await rowFence(trx, config)
      .selectAll()
      .forUpdate()
      .executeTakeFirst();
    if (
      !row ||
      (row.catalogueModel === model.id && row.catalogueVision === model.vision)
    )
      return;
    const updated = await trx
      .updateTable("ai_settings")
      .where("id", "=", 1)
      .set({ catalogueModel: model.id, catalogueVision: model.vision })
      .returningAll()
      .executeTakeFirstOrThrow();
    if (resolve(updated, getConfig().authSecret).token !== config.token) {
      const generation = await trx
        .updateTable("ai_settings")
        .where("id", "=", 1)
        .set({ configGeneration: sql`"configGeneration"+1` })
        .returningAll()
        .executeTakeFirstOrThrow();
      await replaceToken(trx, generation);
    }
  });
  invalidate();
}
export async function saveConfiguration(
  actor: Actor,
  identity: Identity,
  change: {
    enabled?: boolean;
    apiKey?: string | null;
    options?: Partial<Options>;
    selectedModel?: { id: string; vision: boolean | null };
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
      (change.selectedModel &&
        (change.selectedModel.id !== change.options?.model ||
          (change.selectedModel.vision !== null &&
            typeof change.selectedModel.vision !== "boolean"))) ||
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
        : key === null && before.enabled !== false
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
        ...(change.selectedModel
          ? {
              catalogueModel: change.selectedModel.id,
              catalogueVision: change.selectedModel.vision,
            }
          : {}),
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
        before.check.sequence !== row.checkSequence ||
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
export async function authorizeCheckActor(
  trx: Transaction<DB>,
  actor: Actor,
  charge: boolean,
) {
  await lock(trx, locks.membership);
  try {
    await requireAdmin(trx, actor);
  } catch (error) {
    if (error instanceof DomainError) throw new AiError("forbidden", 403);
    throw error;
  }
  if (!charge) return;
  const window = await consumeRateLimitWindow(
    { key: "ai-check:user:" + actor.userId, limit: 10, windowSeconds: 60 },
    trx,
  );
  if (!window.allowed) throw new AiError("provider-rate", 429);
  return window;
}

// Issue once per logical check, before any provider steps or retries.
export async function beginCheck(
  config: Configuration,
  action?: CheckAction,
  wall: Deadline = deadline(config.options.timeoutMs),
): Promise<CheckTicket> {
  return withinTransaction(wall, async (trx) => {
    if (action) await authorizeCheckActor(trx, action.actor, true);
    if (
      !(await rowFence(trx, config).select("id").forUpdate().executeTakeFirst())
    )
      throw new AiError("STALE_CONFIGURATION");
    await requireDispatch(trx, config, action ? "admin" : "check");
    const row = await trx
      .updateTable("ai_settings")
      .where("id", "=", 1)
      .where("revision", "=", config.revision)
      .where("effectiveConfigToken", "=", config.token)
      .set({ checkSequence: sql`"checkSequence"+1` })
      .returning("checkSequence")
      .executeTakeFirst();
    if (!row) throw new AiError("STALE_CONFIGURATION");
    return {
      token: config.token,
      revision: config.revision,
      sequence: row.checkSequence,
      action,
      creditWait: !config.configured && !action,
    };
  });
}
export async function requireDispatch(
  trx: Transaction<DB>,
  config: Configuration,
  purpose: "ordinary" | "check" | "admin",
  ticket?: CheckTicket,
) {
  if (!config.valid || config.diverged || !config.apiKey)
    throw new AiError("AI_NOT_CONFIGURED");
  if (
    ticket &&
    (ticket.token !== config.token || ticket.revision !== config.revision)
  )
    throw new AiError("STALE_CONFIGURATION");
  // Acquire the lock first, then read the database clock. Another transaction
  // can keep the row locked until after a credit window has ended.
  const row = await rowFence(trx, config)
    .select(["checkSequence"])
    .forShare()
    .executeTakeFirst();
  if (!row || (ticket && row.checkSequence !== ticket.sequence))
    throw new AiError("STALE_CONFIGURATION");
  if (purpose === "admin" || config.configured) return;
  if (
    purpose !== "check" ||
    (ticket !== undefined && !ticket.creditWait) ||
    config.enabled !== null
  )
    throw new AiError("AI_NOT_CONFIGURED");
  const wait = await rowFence(trx, config)
    .select("id")
    .where("enabled", "is", null)
    .where("creditWaitConfigToken", "=", config.token)
    .where("creditWaitUntil", ">", sql<Date>`clock_timestamp()`)
    .executeTakeFirst();
  if (!wait) throw new AiError("AI_NOT_CONFIGURED");
}
export async function saveCheck(identity: CheckTicket, result: Check) {
  const value = checkedResult(result);
  const updated = await db
    .updateTable("ai_settings")
    .where("id", "=", 1)
    .where("revision", "=", identity.revision)
    .where("effectiveConfigToken", "=", identity.token)
    .where("checkSequence", "=", identity.sequence)
    .set({
      lastCheck: {
        ...value,
        sequence: identity.sequence,
        configToken: identity.token,
        at: new Date().toISOString(),
      },
    })
    .executeTakeFirst();
  invalidate();
  return updated.numUpdatedRows === 1n;
}
export async function beginCreditWait(identity: CheckTicket) {
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
    .where("checkSequence", "=", identity.sequence)
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
  identity: CheckTicket,
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
      .where("checkSequence", "=", identity.sequence)
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
  trx: Transaction<DB>,
) {
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
}
export async function failingCapability(
  id: Identity,
  capability: Capability,
  signal?: AbortSignal,
) {
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
    .executeTakeFirst({ signal }));
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
