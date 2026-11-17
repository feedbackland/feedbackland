import "server-only";
import type { Kysely, Selectable, Transaction } from "kysely";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getConfig } from "../config";
import { runtimeState, type VectorMetadata } from "../runtime-state";
import { indexConfiguration } from "./index-configuration";
import { physicalVector } from "../../db/vector";
import { log } from "../log";
import { DomainError } from "../domain-error";
import { openSecret, sealSecret } from "../secret-box";
import { lock, locks } from "../../db/locks";
import { requireAdmin, type Actor } from "../auth/authorization";
import { defaults, optionsSchema, keySchema, type Options } from "./defaults";
import { AiError, UnavailableCapability, type Reason } from "./errors";
import type { Capability } from "./constants";
import type { DB, AiSettings } from "../../db/schema";
import { sql } from "kysely";
import { requireLease, type Lease } from "../jobs/leases";
import { db } from "../../db/db";
import { contentTransaction } from "../../db/content-transaction";
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
export type CheckAction = {
  actor: Actor;
  intent: "test-again" | "configure" | "credit";
};
export type CheckTicket = Identity & {
  sequence: string;
  action?: CheckAction;
  creditWait: boolean;
  chatWatermark?: string;
};
const purpose = "ai_settings.apiKey";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const checkIssue = z.enum([
  "invalid-key",
  "management-key",
  "expired-key",
  "account-credit",
  "key-limit",
  "request-exceeds-balance",
  "model-unavailable",
  "privacy",
  "provider-rate",
  "timeout",
  "network",
  "invalid-response",
  "dimension-mismatch",
  "budget",
  "busy",
  "unsupported-model",
  "unavailable",
]);
const checkSchema = z
  .object({
    key: z.enum(["valid", "invalid", "management", "expired", "unknown"]),
    chat: z.enum(["passed", "failed", "untested"]),
    search: z.enum(["passed", "failed", "untested"]),
    chatIssue: checkIssue.optional(),
    searchIssue: checkIssue.optional(),
    actualDimensions: z.number().int().positive().optional(),
    verifiedDimensions: z.number().int().min(1).max(4000).optional(),
    expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
    limitReset: z
      .enum(["daily", "weekly", "monthly", "unknown"])
      .nullable()
      .optional(),
    spendLimit: z.number().finite().nonnegative().nullable().optional(),
    remaining: z.number().finite().nullable().optional(),
  })
  .strict();
export type Check = z.infer<typeof checkSchema>;
export type CheckIssue = z.infer<typeof checkIssue>;
function checkedResult(input: unknown): Check {
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) throw new AiError("invalid-input");
  return parsed.data;
}
const recordedCheck = checkSchema.extend({
  at: z.string(),
  configToken: z.string(),
  sequence: z.string().optional(),
  incidentSince: z.string().optional(),
  chatWatermark: z.string().optional(),
  chatRecoveredAt: z.string().optional(),
});
function resolve(row: Row, secret: string, physicalWidth?: number) {
  const {
    llm,
    dimensions: requestedDimensions,
    explicitDimensions,
  } = getConfig();
  const dimensions =
    physicalWidth ?? runtimeState().vector?.dimensions ?? requestedDimensions;
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
  const configToken = (validOptions: boolean) =>
    digest(
      JSON.stringify([
        row.configGeneration,
        row.revision,
        validOptions,
        row.enabled,
        configured,
        keyDigest,
        row.indexEpoch,
        explicitDimensions ? requestedDimensions : dimensions,
        dimensions,
        // Preserve the installed P07/P08 identity when using the new default.
        ...(Object.keys(defaults) as (keyof Options)[])
          .filter((k) => k !== "searchMaxDistance")
          .map((k) => options[k]),
        ...(options.searchMaxDistance === defaults.searchMaxDistance
          ? []
          : ["search-distance", options.searchMaxDistance]),
      ]),
    );
  const token = configToken(valid);
  // An invalid optional setting can also follow a healthy, keyless boot.
  // A peer with a real key has a different credential digest and identity.
  const emptyCredentials =
    !llm.keySupplied &&
    !(row.enabled === true && (row.apiKey || row.apiKeyDigest));
  const keyless =
    row.enabled === false ||
    (emptyCredentials &&
      (!row.effectiveConfigToken ||
        row.effectiveConfigToken === token ||
        (!valid && row.effectiveConfigToken === configToken(true))));
  const checked = recordedCheck.safeParse(row.lastCheck);
  const check =
    checked.success && checked.data.configToken === token ? checked.data : null;
  return {
    token,
    revision: row.revision,
    configured,
    keyless,
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
export function keyExpired(
  config: Pick<Configuration, "check">,
  now = Date.now(),
) {
  return (
    config.check?.key === "expired" ||
    (!!config.check?.expiresAt && Date.parse(config.check.expiresAt) <= now)
  );
}
export function usableCheckedKey(
  config: Pick<Configuration, "check">,
  now = Date.now(),
) {
  return (
    !keyExpired(config, now) &&
    !["invalid", "management"].includes(config.check?.key ?? "")
  );
}
function transientChatFailure(check: Check) {
  return (
    (check.key === "valid" || check.key === "unknown") &&
    check.chat === "failed" &&
    !["invalid-key", "management-key", "expired-key", "key-limit"].includes(
      check.chatIssue ?? "",
    )
  );
}
async function effectiveCheck(connection: Kysely<DB>, config: Configuration) {
  const check = config.check;
  if (!check || !transientChatFailure(check)) return check;
  const success = await connection
    .selectFrom("ai_health")
    .where("configToken", "=", config.token)
    .where("capability", "=", "chat")
    .where("lastReason", "is", null)
    .where("lastSuccessAt", "is not", null)
    .where("lastAppliedSequence", ">", check.chatWatermark ?? "0")
    .where("lastSuccessAt", ">", new Date(check.at))
    .select("lastSuccessAt")
    .executeTakeFirst();
  return success
    ? {
        ...check,
        chat: "passed" as const,
        chatIssue: undefined,
        chatRecoveredAt: success.lastSuccessAt!.toISOString(),
      }
    : check;
}
export function currentCheck(config: Configuration, signal: AbortSignal) {
  return contentTransaction(signal, (trx) => effectiveCheck(trx, config));
}
export async function insightConfiguration(trx: Transaction<DB>) {
  const row = await currentRow(trx).forShare().executeTakeFirstOrThrow();
  const config = resolve(row, getConfig().authSecret);
  if (config.keyless) throw new AiError("AI_NOT_CONFIGURED");
  if (!config.valid) throw new AiError("AI_UNAVAILABLE");
  if (config.diverged) throw new AiError("CONFIGURATION_DIVERGED");
  if (config.unreadable) throw new AiError("key-unreadable");
  if (!config.configured || !config.apiKey)
    throw new AiError("AI_NOT_CONFIGURED");
  if (!usableCheckedKey(config)) throw new AiError("provider-auth");
  const failure = await failingHealth(trx, config)
    .select("lastReason")
    .where("capability", "=", "chat")
    .executeTakeFirst();
  if (failure) throw new UnavailableCapability(failure.lastReason);
  return config;
}
export { invalidate as invalidateConfiguration };
const clearResults = {
  creditWaitUntil: null,
  creditWaitConfigToken: null,
  lastCheck: null,
};
type RecordedCheck = z.infer<typeof recordedCheck>;
function dependencies(config: Configuration) {
  return {
    model: config.options.model,
    vision: config.options.vision,
    privacy: config.options.privacy,
    embeddingModel: config.options.embeddingModel,
    dimensions: config.dimensions,
    epoch: config.indexEpoch,
  };
}
function transferCheck(
  check: RecordedCheck | null,
  from: ReturnType<typeof dependencies>,
  to: Configuration,
) {
  if (!check) return undefined;
  const next = { ...check };
  if (
    from.privacy !== to.options.privacy ||
    from.model !== to.options.model ||
    from.vision !== to.options.vision
  ) {
    if (
      check.key === "valid" &&
      !["account-credit", "key-limit"].includes(check.chatIssue ?? "")
    ) {
      next.chat = "untested";
      delete next.chatIssue;
      delete next.chatWatermark;
      delete next.chatRecoveredAt;
    }
  }
  if (
    from.privacy !== to.options.privacy ||
    from.embeddingModel !== to.options.embeddingModel ||
    from.dimensions !== to.dimensions ||
    from.epoch !== to.indexEpoch
  ) {
    next.search = "untested";
    delete next.searchIssue;
    delete next.verifiedDimensions;
    delete next.actualDimensions;
  }
  return next;
}
const currentRow = (connection: Kysely<DB>) =>
  connection.selectFrom("ai_settings").where("id", "=", 1).selectAll();
function indexFields(row: Row, physical: VectorMetadata | null) {
  return {
    config: resolve(row, getConfig().authSecret, physical?.dimensions),
    epoch: row.indexEpoch,
    storedFingerprint: row.indexFingerprint,
    physical,
  };
}
export async function lockedIndexSettings(
  trx: Transaction<DB>,
  exclusive: boolean,
) {
  // Serialize the catalog read with generation initialization and both-table rebuilds.
  const query = currentRow(trx);
  const row = await (
    exclusive ? query.forUpdate() : query.forShare()
  ).executeTakeFirstOrThrow();
  return indexFields(row, await physicalVector(trx));
}
type IndexFingerprint = {
  model: string;
  dimensions: number;
  generation: string;
};
export async function advanceIndexGeneration(
  trx: Transaction<DB>,
  fingerprint: IndexFingerprint,
  physical: VectorMetadata,
  previous: Configuration,
  initializing = false,
) {
  const row = await trx
    .updateTable("ai_settings")
    .where("id", "=", 1)
    .set({ indexEpoch: sql`"indexEpoch"+1`, indexFingerprint: fingerprint })
    .returningAll()
    .executeTakeFirstOrThrow();
  const next = resolve(row, getConfig().authSecret, physical.dimensions);
  const evidence = await effectiveCheck(trx, previous);
  const verifiedInitialSearch =
    initializing &&
    evidence?.key === "valid" &&
    evidence.search === "passed" &&
    evidence.verifiedDimensions === physical.dimensions &&
    previous.options.embeddingModel === fingerprint.model;
  // Only the embedding generation changed under this lock. Keep credential
  // and chat observations with their original timestamps and sequences.
  const saved = await trx
    .updateTable("ai_settings")
    .where("id", "=", 1)
    .set({
      effectiveConfigToken: next.token,
      lastCheck: evidence
        ? {
            ...evidence,
            configToken: next.token,
            chatWatermark: "0",
            search: verifiedInitialSearch ? "passed" : "untested",
            ...(!verifiedInitialSearch
              ? {
                  searchIssue: undefined,
                  actualDimensions: undefined,
                  verifiedDimensions: undefined,
                }
              : {}),
          }
        : null,
      creditWaitConfigToken:
        row.creditWaitConfigToken === previous.token
          ? next.token
          : row.creditWaitConfigToken,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return indexFields(saved, physical);
}
export async function matchesIndexGeneration(
  trx: Transaction<DB>,
  epoch: string,
  expected?: { token: string; fingerprint: IndexFingerprint },
) {
  let query = trx
    .selectFrom("ai_settings")
    .select("id")
    .where("id", "=", 1)
    .where("indexEpoch", "=", epoch);
  if (expected)
    query = query
      .where("effectiveConfigToken", "=", expected.token)
      .where(
        sql<boolean>`"indexFingerprint"=${JSON.stringify(expected.fingerprint)}::jsonb`,
      );
  return !!(await query.forShare().executeTakeFirst());
}
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
  fresh = false,
): Promise<Configuration> {
  const state = runtimeState();
  if (!fresh && state.aiConfig && performance.now() < state.aiConfig.until)
    return state.aiConfig.value;
  const generation = state.aiConfigGeneration,
    started = performance.now();
  const row = signal
    ? await contentTransaction(signal, (trx) =>
        currentRow(trx).executeTakeFirst(),
      )
    : await currentRow(db).executeTakeFirst();
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
  check?: Check | RecordedCheck,
  secret = getConfig().authSecret,
  physicalWidth?: number,
  waitUntil?: Date | null,
) {
  const value = resolve(row, secret, physicalWidth);
  await trx
    .updateTable("ai_settings")
    .set({
      effectiveConfigToken: value.token,
      ...clearResults,
      ...(waitUntil && {
        creditWaitUntil: waitUntil,
        creditWaitConfigToken: value.token,
      }),
      lastCheck: check
        ? {
            ...check,
            at: "at" in check ? check.at : new Date().toISOString(),
            chatWatermark:
              "configToken" in check && check.configToken !== value.token
                ? "0"
                : "chatWatermark" in check
                  ? check.chatWatermark
                  : undefined,
            configToken: value.token,
            sequence: "at" in check ? check.sequence : row.checkSequence,
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
    const current = resolve(row, getConfig().authSecret);
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
      await replaceToken(
        trx,
        generation,
        transferCheck(
          await effectiveCheck(trx, current),
          dependencies(current),
          resolve(generation, getConfig().authSecret),
        ),
        undefined,
        undefined,
        row.creditWaitConfigToken === config.token ? row.creditWaitUntil : null,
      );
    }
  });
  invalidate();
}
type ConfigurationChange = {
  enabled?: boolean;
  apiKey?: string | null;
  options?: Partial<Options>;
  selectedModel?: { id: string; vision: boolean | null };
  stageKey?: boolean;
};
async function writeConfiguration(
  trx: Transaction<DB>,
  actor: Actor,
  identity: Identity,
  change: ConfigurationChange,
) {
  await lock(trx, locks.membership);
  await requireAdmin(trx, actor);
  const row = await currentRow(trx).forUpdate().executeTakeFirstOrThrow();
  const before = resolve(row, getConfig().authSecret);
  if (!matches(row, identity) || before.diverged)
    throw new AiError("STALE_CONFIGURATION");
  const env = getConfig().llm;
  if (
    (change.apiKey !== undefined && env.keySupplied) ||
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
    change.stageKey && key
      ? null
      : change.enabled !== undefined
        ? change.enabled
        : key === null && before.enabled !== false
          ? null
          : key && digest(key) !== before.keyDigest && before.enabled !== false
            ? null
            : before.enabled;
  if (change.enabled === true && key && digest(key) !== before.keyDigest)
    throw new AiError("STALE_CONFIGURATION");
  const undoExpiry =
    change.stageKey && key
      ? (
          await sql<{
            expires: Date;
          }>`select clock_timestamp()+interval '5 minutes' as expires`.execute(
            trx,
          )
        ).rows[0].expires.toISOString()
      : null;
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
      keyUndo:
        change.stageKey && key
          ? {
              actor: actor.userId,
              targetRevision: String(BigInt(row.revision) + 1n),
              dependencies: dependencies(before),
              expiresAt: undoExpiry!,
              apiKey: row.apiKey,
              apiKeyDigest: row.apiKeyDigest,
              apiKeyLast4: row.apiKeyLast4,
              apiKeySetAt: row.apiKeySetAt?.toISOString() ?? null,
              enabled: row.enabled,
              keepOffAt: row.keepOffAt?.toISOString() ?? null,
              keepOffBy: row.keepOffBy,
              check: await effectiveCheck(trx, before),
              creditUntil:
                row.creditWaitConfigToken === before.token
                  ? (row.creditWaitUntil?.toISOString() ?? null)
                  : null,
            }
          : null,
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
  const sameKey =
    !!before.keyDigest &&
    before.keyDigest === after.keyDigest &&
    !change.stageKey;
  const transfer = sameKey
    ? transferCheck(
        await effectiveCheck(trx, before),
        dependencies(before),
        after,
      )
    : undefined;
  if (before.enabled !== true && updated.enabled === true) {
    if (
      !usableCheckedKey(before) ||
      before.check?.key !== "valid" ||
      before.check.sequence !== row.checkSequence ||
      before.check.chat !== "passed" ||
      before.keyDigest !== after.keyDigest ||
      before.options.model !== after.options.model ||
      before.options.privacy !== after.options.privacy ||
      before.options.vision !== after.options.vision
    )
      throw new AiError("STALE_CONFIGURATION");
  }
  const continuingWait =
    sameKey &&
    updated.enabled === null &&
    row.creditWaitConfigToken === before.token;
  return replaceToken(
    trx,
    updated,
    transfer,
    undefined,
    undefined,
    continuingWait ? row.creditWaitUntil : null,
  );
}
export async function saveConfiguration(
  actor: Actor,
  identity: Identity,
  change: ConfigurationChange,
) {
  const result = await db
    .transaction()
    .execute((trx) => writeConfiguration(trx, actor, identity, change));
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
  lease?: Lease,
): Promise<CheckTicket> {
  return withinTransaction(wall, async (trx) => {
    if (lease) await requireLease(trx, lease);
    return issueCheck(trx, config, action, !!lease);
  });
}
export async function stageKeyCheck(
  actor: Actor,
  identity: Identity,
  key: string,
  wall: Deadline,
) {
  const staged = await withinTransaction(wall, async (trx) => {
    await writeConfiguration(trx, actor, identity, {
      apiKey: key,
      stageKey: true,
    });
    const config = resolve(
      await currentRow(trx).executeTakeFirstOrThrow(),
      getConfig().authSecret,
    );
    const ticket = await issueCheck(
      trx,
      config,
      { actor, intent: "configure" },
      false,
    );
    return { config, ticket };
  });
  invalidate();
  return staged;
}
async function issueCheck(
  trx: Transaction<DB>,
  config: Configuration,
  action: CheckAction | undefined,
  leased: boolean,
): Promise<CheckTicket> {
  if (action) await authorizeCheckActor(trx, action.actor, true);
  if (
    !(await rowFence(trx, config).select("id").forUpdate().executeTakeFirst())
  )
    throw new AiError("STALE_CONFIGURATION");
  await requireDispatch(trx, config, action ? "admin" : "check");
  if (
    action?.intent === "credit" ||
    (leased && !action && !config.configured)
  ) {
    if (!usableCheckedKey(config)) throw new AiError("AI_NOT_CONFIGURED");
    const pending = await rowFence(trx, config)
      .where("enabled", "is", null)
      .where("creditWaitConfigToken", "=", config.token)
      .where("creditWaitUntil", ">", sql<Date>`clock_timestamp()`)
      .select("id")
      .executeTakeFirst();
    if (!pending) throw new AiError("AI_NOT_CONFIGURED");
    const key = "ai:credit-poll:" + config.keyDigest;
    // Use database wall time after the row lock. Rejected polls never move the deadline.
    const poll = await sql<{
      accepted: boolean;
    }>`insert into rate_limit(key,count,"windowStart") values (${key},1,clock_timestamp())
        on conflict(key) do update set count=1,"windowStart"=clock_timestamp()
        where rate_limit."windowStart" <= clock_timestamp()-interval '15 seconds' returning true as accepted`.execute(
      trx,
    );
    if (!poll.rows.length) {
      const delay = await sql<{
        ms: number;
      }>`select greatest(1,ceil(extract(epoch from ("windowStart"+interval '15 seconds'-clock_timestamp()))*1000))::int as ms from rate_limit where key=${key}`.execute(
        trx,
      );
      throw new AiError("AI_BUSY", 429, delay.rows[0].ms);
    }
  }
  const row = await trx
    .updateTable("ai_settings")
    .where("id", "=", 1)
    .where("revision", "=", config.revision)
    .where("effectiveConfigToken", "=", config.token)
    .set({ checkSequence: sql`"checkSequence"+1` })
    .returning("checkSequence")
    .executeTakeFirst();
  if (!row) throw new AiError("STALE_CONFIGURATION");
  const health = await trx
    .selectFrom("ai_health")
    .select("nextSequence")
    .where("configToken", "=", config.token)
    .where("capability", "=", "chat")
    .executeTakeFirst();
  return {
    token: config.token,
    revision: config.revision,
    sequence: row.checkSequence,
    chatWatermark: health?.nextSequence ?? "0",
    action,
    creditWait: action?.intent === "credit" || (!config.configured && !action),
  };
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
    .select(["checkSequence", "lastCheck"])
    .forShare()
    .executeTakeFirst();
  if (!row || (ticket && row.checkSequence !== ticket.sequence))
    throw new AiError("STALE_CONFIGURATION");
  if (purpose === "ordinary") {
    const stored = recordedCheck.safeParse(row.lastCheck);
    if (
      stored.success &&
      stored.data.configToken === config.token &&
      !usableCheckedKey({ check: stored.data })
    )
      throw new AiError("provider-auth");
  }
  if (!ticket?.creditWait && (purpose === "admin" || config.configured)) return;
  if (
    (purpose !== "check" && !ticket?.creditWait) ||
    (ticket !== undefined && !ticket.creditWait) ||
    config.enabled !== null
  )
    throw new AiError("AI_NOT_CONFIGURED");
  if (!usableCheckedKey(config)) throw new AiError("AI_NOT_CONFIGURED");
  const wait = await rowFence(trx, config)
    .select("id")
    .where("enabled", "is", null)
    .where("creditWaitConfigToken", "=", config.token)
    .where("creditWaitUntil", ">", sql<Date>`clock_timestamp()`)
    .executeTakeFirst();
  if (!wait) throw new AiError("AI_NOT_CONFIGURED");
}
export async function saveCheck(
  identity: CheckTicket,
  result: Check,
  owner?: { lease: Lease; signal: AbortSignal },
) {
  const value = checkedResult(result);
  const updated = await contentTransaction(owner?.signal, async (trx) => {
    if (owner) await requireLease(trx, owner.lease);
    const written = await trx
      .updateTable("ai_settings")
      .where("id", "=", 1)
      .where("revision", "=", identity.revision)
      .where("effectiveConfigToken", "=", identity.token)
      .where("checkSequence", "=", identity.sequence)
      .set({
        lastCheck: {
          ...value,
          chatWatermark: identity.chatWatermark,
          sequence: identity.sequence,
          configToken: identity.token,
          at: new Date().toISOString(),
        },
      })
      .executeTakeFirst();
    if (owner) await requireLease(trx, owner.lease);
    return written;
  });
  invalidate();
  return updated.numUpdatedRows === 1n;
}
export function pendingCreditCheck(config: Identity, signal: AbortSignal) {
  return contentTransaction(signal, (trx) =>
    rowFence(trx, config)
      .select("creditWaitUntil")
      .where("enabled", "is", null)
      .where("creditWaitConfigToken", "=", config.token)
      .where("creditWaitUntil", ">", sql<Date>`clock_timestamp()`)
      .executeTakeFirst(),
  );
}
export function unhealthyCapabilities(config: Identity, signal: AbortSignal) {
  return contentTransaction(signal, (trx) =>
    failingHealth(trx, config).select("capability").execute(),
  );
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
  lease?: Lease,
) {
  const check = checkedResult(result);
  if (check.key !== "valid" || check.chat !== "passed") return null;
  const enabled = await db.transaction().execute(async (trx) => {
    if (lease) await requireLease(trx, lease);
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
        keyUndo: advanceUndo(
          row,
          identity.action?.intent === "credit"
            ? undefined
            : identity.action?.actor,
        ),
        revision: sql`revision+1`,
        updatedAt: sql`clock_timestamp()`,
        keepOffAt: null,
        keepOffBy: null,
      })
      .returningAll()
      .executeTakeFirst();
    if (!next) return null;
    const saved = await replaceToken(trx, next, check);
    if (lease) await requireLease(trx, lease);
    return saved;
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
function failingHealth(connection: Kysely<DB>, id: Identity) {
  return connection
    .selectFrom("ai_health")
    .where("configToken", "=", id.token)
    .where(
      "failingSince",
      "<",
      sql<Date>`clock_timestamp()-interval '15 minutes'`,
    )
    .where(
      "lastFailureAt",
      ">",
      sql<Date>`clock_timestamp()-interval '10 minutes'`,
    );
}
export async function capabilityFailure(
  id: Identity,
  capability: Capability,
  signal?: AbortSignal,
) {
  const read = (connection: Kysely<DB>) =>
    failingHealth(connection, id)
      .select("lastReason")
      .where("capability", "=", capability)
      .executeTakeFirst();
  return signal ? contentTransaction(signal, read) : read(db);
}
export async function failingCapability(
  id: Identity,
  capability: Capability,
  signal?: AbortSignal,
) {
  return !!(await capabilityFailure(id, capability, signal));
}

export async function sweepHealth() {
  await db
    .updateTable("ai_settings")
    .set({ keyUndo: null })
    .where(
      sql<boolean>`"keyUndo" is not null and ("keyUndo"->>'expiresAt')::timestamptz <= clock_timestamp()`,
    )
    .execute();
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

const undoRecord = z.object({
  actor: z.string(),
  targetRevision: z.string(),
  dependencies: z.object({
    model: z.string(),
    vision: z.boolean(),
    privacy: z.enum(["deny", "zdr", "allow"]),
    embeddingModel: z.string(),
    dimensions: z.number(),
    epoch: z.string(),
  }),
  expiresAt: z.iso.datetime(),
  apiKey: z.string().nullable(),
  apiKeyDigest: z.string().nullable(),
  apiKeyLast4: z.string().nullable(),
  apiKeySetAt: z.iso.datetime().nullable(),
  enabled: z.boolean().nullable(),
  keepOffAt: z.iso.datetime().nullable(),
  keepOffBy: z.string().nullable(),
  check: recordedCheck.nullable(),
  creditUntil: z.iso.datetime().nullable(),
});

function advanceUndo(row: Row, actor?: Actor) {
  const receipt = undoRecord.safeParse(row.keyUndo);
  if (
    !receipt.success ||
    receipt.data.targetRevision !== row.revision ||
    (actor && receipt.data.actor !== actor.userId)
  )
    return null;
  return { ...receipt.data, targetRevision: String(BigInt(row.revision) + 1n) };
}
export async function undoKey(actor: Actor, identity: Identity) {
  const saved = await db.transaction().execute(async (trx) => {
    await authorizeCheckActor(trx, actor, false);
    const row = await currentRow(trx).forUpdate().executeTakeFirstOrThrow();
    const prior = undoRecord.safeParse(row.keyUndo);
    const now = (
      await sql<{ now: Date }>`select clock_timestamp() as now`.execute(trx)
    ).rows[0].now;
    if (
      !matches(row, identity) ||
      resolve(row, getConfig().authSecret).diverged ||
      getConfig().llm.keySupplied ||
      !prior.success ||
      prior.data.actor !== actor.userId ||
      prior.data.targetRevision !== row.revision ||
      Date.parse(prior.data.expiresAt) <= now.getTime()
    )
      throw new AiError("STALE_CONFIGURATION");
    const p = prior.data;
    const updated = await trx
      .updateTable("ai_settings")
      .where("id", "=", 1)
      .set({
        apiKey: p.apiKey,
        apiKeyDigest: p.apiKeyDigest,
        apiKeyLast4: p.apiKeyLast4,
        apiKeySetAt: p.apiKeySetAt,
        enabled: p.enabled,
        keepOffAt: p.keepOffAt,
        keepOffBy: p.keepOffBy,
        keyUndo: null,
        updatedBy: actor.userId,
        updatedAt: sql<Date>`clock_timestamp()`,
        revision: sql`revision+1`,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const restored = await replaceToken(
      trx,
      updated,
      transferCheck(
        p.check,
        p.dependencies,
        resolve(updated, getConfig().authSecret),
      ),
    );
    if (p.creditUntil)
      await trx
        .updateTable("ai_settings")
        .where("id", "=", 1)
        .set({
          creditWaitConfigToken: restored.token,
          creditWaitUntil: p.creditUntil,
        })
        .execute();
    return restored;
  });
  invalidate();
  return saved;
}

/** Commit all check fields together. A settings change or a newer check wins even if the old provider response arrives last. */
function incidentReason(check: Check | null) {
  if (!check) return null;
  return (
    check.chatIssue ??
    check.searchIssue ??
    (["invalid", "expired", "management"].includes(check.key)
      ? check.key
      : null)
  );
}
export async function finishConnectionCheck(
  ticket: CheckTicket,
  result: Check,
  enable: boolean,
  worker?: { lease: Lease; signal: AbortSignal },
) {
  if (!ticket.action && !worker) throw new AiError("forbidden");
  const actor = ticket.action?.actor,
    value = checkedResult(result);
  const saved = await contentTransaction(worker?.signal, async (trx) => {
    if (worker) await requireLease(trx, worker.lease);
    if (actor) await authorizeCheckActor(trx, actor, false);
    const row = await currentRow(trx).forUpdate().executeTakeFirstOrThrow();
    const config = resolve(row, getConfig().authSecret);
    if (
      !matches(row, ticket) ||
      config.diverged ||
      row.checkSequence !== ticket.sequence
    )
      throw new AiError("STALE_CONFIGURATION");
    const clock = (
      await sql<{ now: Date }>`select clock_timestamp() as now`.execute(trx)
    ).rows[0].now;
    const waiting =
      row.enabled === null &&
      row.creditWaitConfigToken === ticket.token &&
      !!row.creditWaitUntil &&
      row.creditWaitUntil > clock;
    if (ticket.creditWait && !waiting) throw new AiError("STALE_CONFIGURATION");
    const prior = await effectiveCheck(trx, config);
    const reason = incidentReason(value);
    const observation = {
      ...value,
      at: clock.toISOString(),
      sequence: ticket.sequence,
      configToken: ticket.token,
      chatWatermark: ticket.chatWatermark,
      incidentSince: reason
        ? ((reason === incidentReason(prior)
            ? (prior?.incidentSince ?? prior?.at)
            : undefined) ?? clock.toISOString())
        : undefined,
    };
    if (worker) await requireLease(trx, worker.lease);
    const retryStaged =
      ticket.action?.intent === "test-again" &&
      row.enabled === null &&
      !!row.apiKey;
    if (
      (enable || waiting || retryStaged) &&
      value.key === "valid" &&
      value.chat === "passed" &&
      row.enabled !== true
    ) {
      const updated = await trx
        .updateTable("ai_settings")
        .where("id", "=", 1)
        .set({
          enabled: true,
          keyUndo: advanceUndo(
            row,
            ticket.action?.intent === "credit" ? undefined : actor,
          ),
          keepOffBy: null,
          keepOffAt: null,
          revision: sql`revision+1`,
          ...(actor && { updatedBy: actor.userId }),
          updatedAt: clock,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return replaceToken(trx, updated, observation);
    }
    if (
      enable &&
      !config.configured &&
      value.chatIssue === "account-credit" &&
      row.apiKey &&
      row.apiKeySetAt &&
      !getConfig().llm.apiKey
    ) {
      let current = row,
        identity: Identity = ticket;
      if (row.enabled === false) {
        current = await trx
          .updateTable("ai_settings")
          .where("id", "=", 1)
          .set({
            enabled: null,
            keepOffBy: null,
            keepOffAt: null,
            revision: sql`revision+1`,
            ...(actor && { updatedBy: actor.userId }),
            updatedAt: clock,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        identity = await replaceToken(trx, current, observation);
      }
      const until = new Date(row.apiKeySetAt.getTime() + 7 * 86400_000);
      if (until > clock)
        await trx
          .updateTable("ai_settings")
          .where("id", "=", 1)
          .set({
            creditWaitUntil: until,
            creditWaitConfigToken: identity.token,
          })
          .execute();
      await trx
        .updateTable("ai_settings")
        .where("id", "=", 1)
        .set({
          lastCheck: { ...observation, configToken: identity.token },
        })
        .execute();
      return { token: identity.token, revision: identity.revision };
    }
    await trx
      .updateTable("ai_settings")
      .where("id", "=", 1)
      .set({
        ...(waiting &&
          [
            "invalid-key",
            "management-key",
            "expired-key",
            "key-limit",
          ].includes(value.chatIssue ?? "") && {
            creditWaitUntil: null,
            creditWaitConfigToken: null,
          }),
        lastCheck: observation,
      })
      .execute();
    return { token: ticket.token, revision: ticket.revision };
  });
  invalidate();
  return saved;
}

export async function connectAdmission(
  actor: Actor,
  identity: Identity,
  claim?: string,
) {
  return db.transaction().execute(async (trx) => {
    await authorizeCheckActor(trx, actor, !claim);
    const row = await currentRow(trx).forShare().executeTakeFirstOrThrow();
    if (
      claim &&
      (await trx
        .selectFrom("rate_limit")
        .select("key")
        .where("key", "=", "connect:" + claim)
        .executeTakeFirst())
    )
      return false;
    if (
      !matches(row, identity) ||
      resolve(row, getConfig().authSecret).diverged
    )
      throw new AiError("STALE_CONFIGURATION");
    if (getConfig().llm.keySupplied) throw new AiError("invalid-input");
    if (!claim) return true;
    return !!(await trx
      .insertInto("rate_limit")
      .values({ key: "connect:" + claim, count: 1 })
      .onConflict((c) => c.column("key").doNothing())
      .returning("key")
      .executeTakeFirst());
  });
}

export async function adminAiState(actor: Actor, signal?: AbortSignal) {
  return contentTransaction(signal, async (trx) => {
    await requireAdmin(trx, actor);
    const row = await currentRow(trx).forShare().executeTakeFirstOrThrow(),
      env = getConfig().llm;
    const config = resolve(row, getConfig().authSecret);
    const {
      rows: [budget],
    } = await sql<{
      now: Date;
      resetAt: Date;
      used: number;
      diagnostic: number;
    }>`
      with instant as (select clock_timestamp() at time zone 'UTC' as t), clock as (select t,to_char(t,'YYYY-MM-DD') as day from instant)
      select t at time zone 'UTC' as now,(date_trunc('day',t)+interval '1 day') at time zone 'UTC' as "resetAt",
        coalesce((select count from rate_limit where key='ai:instance:day:'||day),0) as used,
        coalesce((select count from rate_limit where key='ai:instance:day:diagnostic:'||day),0) as diagnostic from clock`.execute(
      trx,
    );
    config.check = await effectiveCheck(trx, config);
    const expiredKey = keyExpired(config, budget.now.getTime());
    const rebuildRequired =
      config.configured &&
      config.options.embeddingModel !== "none" &&
      indexConfiguration(
        row.indexFingerprint,
        config.options.embeddingModel,
        config.dimensions,
        config.widthMismatch,
        runtimeState().vector?.indexesValid,
      ).rebuildRequired;
    const failures = await failingHealth(trx, config)
      .select(["capability", "lastReason", "failingSince"])
      .orderBy("failingSince")
      .orderBy("capability")
      .execute();
    const waiting =
      !expiredKey &&
      row.enabled === null &&
      row.creditWaitConfigToken === config.token &&
      !!row.creditWaitUntil;
    const expired = waiting && row.creditWaitUntil! <= budget.now;
    const state =
      row.enabled === false
        ? "off"
        : config.unreadable || !config.valid || config.diverged
          ? "attention"
          : waiting && !expired
            ? "credit"
            : expired
              ? "expired"
              : (config.check &&
                    (!usableCheckedKey(config, budget.now.getTime()) ||
                      config.check.chat === "failed" ||
                      config.check.search === "failed")) ||
                  rebuildRequired ||
                  failures.length
                ? "attention"
                : !config.configured
                  ? "off"
                  : budget.used >=
                      Math.floor(config.options.dailyCallLimit * 0.8)
                    ? "paused"
                    : "on";
    const incident =
      failures[0]?.failingSince?.toISOString() ??
      config.check?.incidentSince ??
      config.check?.at ??
      row.updatedAt.toISOString();
    const notices = await trx
      .selectFrom("admin_notice")
      .select(["notice", "dismissedAt", "hiddenUntil"])
      .where("userId", "=", actor.userId)
      .execute();
    const hidden = (name: keyof typeof noticeKeys) =>
      notices.some(
        (n) =>
          n.notice === noticeKeys[name] &&
          (name === "failure"
            ? !!incident && n.dismissedAt >= new Date(incident)
            : !!n.hiddenUntil && n.hiddenUntil > budget.now),
      );
    const undo = undoRecord.safeParse(row.keyUndo);
    const canUndo =
      undo.success &&
      undo.data.actor === actor.userId &&
      undo.data.targetRevision === row.revision &&
      Date.parse(undo.data.expiresAt) > budget.now.getTime();
    const who = row.keepOffBy
      ? await trx
          .selectFrom("user")
          .select("name")
          .where("id", "=", row.keepOffBy)
          .executeTakeFirst()
      : null;
    return {
      statusVersion: digest(
        JSON.stringify([
          config.token,
          state,
          config.check,
          rebuildRequired,
          expiredKey,
          budget.resetAt,
          budget.used,
          budget.diagnostic,
          failures,
          hidden("off"),
          hidden("context"),
          hidden("failure"),
          canUndo,
          expired,
        ]),
      ),
      state,
      chatAvailable:
        config.configured &&
        !config.diverged &&
        !!config.apiKey &&
        usableCheckedKey(config, budget.now.getTime()) &&
        config.check?.chat !== "failed" &&
        !failures.some((f) => f.capability === "chat") &&
        budget.used < Math.floor(config.options.dailyCallLimit * 0.8),
      identity: { token: config.token, revision: row.revision },
      options: config.options,
      dimensions: config.dimensions,
      rebuildRequired,
      creditCheckInFlight:
        waiting && !expired && row.checkSequence !== config.check?.sequence,
      nextCreditCheckAt:
        waiting && !expired
          ? ((
              await trx
                .selectFrom("rate_limit")
                .where("key", "=", "ai:credit-poll:" + config.keyDigest)
                .select(
                  sql<Date>`"windowStart"+interval '15 seconds'`.as("next"),
                )
                .executeTakeFirst()
            )?.next ?? budget.now)
          : null,
      locked: Object.keys(env.options).filter(
        (k) => env.options[k as keyof Options] !== undefined,
      ),
      keySource: env.keySupplied
        ? "environment"
        : row.apiKey
          ? "stored"
          : "none",
      last4: env.apiKey?.slice(-4) ?? row.apiKeyLast4,
      keyUrl: config.keyDigest
        ? "https://openrouter.ai/keys/" + config.keyDigest
        : null,
      unreadable: config.unreadable,
      canEnable: !!config.apiKey && !config.unreadable,
      enabled: config.enabled,
      keptOffAt: row.keepOffAt,
      keptOffBy: who?.name ?? null,
      creditWaitUntil: waiting ? row.creditWaitUntil : null,
      check: config.check,
      failures,
      reason: config.unreadable
        ? "unreadable"
        : !config.valid
          ? "invalid-environment"
          : config.diverged
            ? "replica-mismatch"
            : expiredKey
              ? "expired-key"
              : (config.check?.chatIssue ??
                config.check?.searchIssue ??
                (rebuildRequired ? "rebuild-required" : null) ??
                failures[0]?.lastReason ??
                null),
      budget,
      undo: canUndo,
      hideActivity: hidden("off"),
      hideContext: hidden("context"),
      hideFailure: hidden("failure"),
    };
  });
}

const noticeKeys = {
  off: "ai-off-card",
  context: "ai-unseen-notice",
  failure: "ai-broken-card",
} as const;
export async function dismissAiNotice(
  actor: Actor,
  notice: "off" | "context" | "failure",
) {
  await db.transaction().execute(async (trx) => {
    await authorizeCheckActor(trx, actor, false);
    const hiddenUntil =
      notice === "failure"
        ? null
        : sql<Date>`clock_timestamp()+interval '14 days'`;
    await trx
      .insertInto("admin_notice")
      .values({ userId: actor.userId, notice: noticeKeys[notice], hiddenUntil })
      .onConflict((c) =>
        c.columns(["userId", "notice"]).doUpdateSet({
          hiddenUntil,
          dismissedAt: sql<Date>`clock_timestamp()`,
        }),
      )
      .execute();
  });
}
