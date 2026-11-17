import "server-only";
import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { DomainError } from "@/lib/domain-error";
import { AiError, DailyBudgetError } from "@/lib/llm/errors";
import { optionsSchema } from "@/lib/llm/defaults";
import {
  adminAiState,
  configuration,
  dismissAiNotice,
  saveConfiguration,
  undoKey,
} from "@/lib/llm/settings-store";
import { finishConnect, startConnect, finishInput } from "@/lib/llm/connect";
import { readProviderMetadata } from "@/lib/llm/client";
import {
  checkConnection,
  installKey,
  updateAiOptions,
} from "@/lib/llm/onboarding";
import { keyProblem } from "@/lib/ai-onboarding-copy";
import { adminUsage, noticeCounts } from "@/lib/llm/admin-usage";

const identity = z
  .object({
    revision: z.string().regex(/^[1-9][0-9]{0,18}$/),
    token: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
async function run<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (e) {
    if (e instanceof DomainError) throw e;
    if (e instanceof AiError) {
      if (e.reason === "STALE_CONFIGURATION")
        throw new DomainError(
          "CONFLICT",
          "AI settings changed. Reload and review the current settings.",
        );
      if (e.reason === "forbidden")
        throw new DomainError(
          "FORBIDDEN",
          "Sign in again with an administrator account.",
        );
      if (e.reason === "invalid-input")
        throw new DomainError(
          "BAD_REQUEST",
          "Check this value and any server-managed settings.",
        );
      if (e instanceof DailyBudgetError)
        throw new DomainError(
          "TOO_MANY_REQUESTS",
          "The daily allowance is exhausted.",
          e.retryAfterSeconds,
          e.resetsAt,
        );
      if (e.reason === "provider-rate" || e.reason === "AI_BUSY")
        throw new DomainError(
          "TOO_MANY_REQUESTS",
          "A check is already running or was recently requested. Try again shortly.",
          e.retryAfterMs ? Math.ceil(e.retryAfterMs / 1000) : undefined,
          undefined,
          undefined,
          e.retryAfterMs,
        );
    }
    throw new DomainError(
      "SERVICE_UNAVAILABLE",
      "The AI settings could not be verified. Try again.",
    );
  }
}
function channel(ctx: {
  headers?: Headers;
  responseHeaders?: Headers;
  signal?: AbortSignal;
}) {
  if (!ctx.headers || !ctx.responseHeaders)
    throw new DomainError(
      "BAD_REQUEST",
      "This action needs an active board session.",
    );
  return {
    headers: ctx.headers,
    responseHeaders: ctx.responseHeaders,
    signal: ctx.signal,
  };
}
export const getAiStatus = adminProcedure.query(({ ctx }) =>
  run(() => adminAiState(ctx, ctx.signal)),
);
export const getAiUsage = adminProcedure.query(({ ctx }) =>
  run(() => adminUsage(ctx, ctx.signal)),
);
export const getAiNoticeCounts = adminProcedure.query(({ ctx }) =>
  run(async () => {
    const state = await adminAiState(ctx, ctx.signal);
    return noticeCounts(
      ctx,
      state.failures.find((f) => f.capability === "chat")?.failingSince ??
        (state.check?.chat === "failed"
          ? new Date(state.check.incidentSince ?? state.check.at)
          : null),
      ctx.signal,
    );
  }),
);
export const saveAiOptions = adminProcedure
  .input(z.object({ identity, options: optionsSchema }).strict())
  .mutation(({ ctx, input }) =>
    run(() => updateAiOptions(ctx, input.identity, input.options, ctx.signal)),
  );
export const pasteAiKey = adminProcedure
  .input(z.object({ identity, key: z.string().max(512) }).strict())
  .mutation(({ ctx, input }) =>
    run(async () => {
      const problem = keyProblem(input.key);
      if (problem) throw new DomainError("BAD_REQUEST", problem);
      return installKey(ctx, input.identity, input.key, ctx.signal);
    }),
  );
export const changeAiKey = adminProcedure
  .input(
    z
      .object({
        identity,
        action: z.enum([
          "enable",
          "keep-off",
          "remove",
          "undo",
          "test-again",
          "credit",
        ]),
      })
      .strict(),
  )
  .mutation(({ ctx, input }) =>
    run(async () => {
      switch (input.action) {
        case "keep-off":
          return saveConfiguration(ctx, input.identity, { enabled: false });
        case "remove":
          return saveConfiguration(ctx, input.identity, { apiKey: null });
        case "undo":
          return undoKey(ctx, input.identity);
        default:
          return (
            await checkConnection(ctx, input.identity, input.action, ctx.signal)
          ).identity;
      }
    }),
  );
export const startOpenRouter = adminProcedure
  .input(z.object({ identity, unlisted: z.boolean() }).strict())
  .mutation(({ ctx, input }) =>
    run(() => startConnect(ctx, input.identity, input.unlisted, channel(ctx))),
  );
export const finishOpenRouter = adminProcedure
  .input(finishInput)
  .mutation(({ ctx, input }) =>
    run(() => finishConnect(ctx, input, channel(ctx))),
  );
export const dismissAiNoticeForMe = adminProcedure
  .input(z.object({ notice: z.enum(["off", "context", "failure"]) }).strict())
  .mutation(({ ctx, input }) => run(() => dismissAiNotice(ctx, input.notice)));
export const getAiKeyInfo = adminProcedure
  .input(identity)
  .mutation(({ ctx, input }) =>
    run(async () => {
      const config = await configuration(ctx.signal, true);
      if (config.token !== input.token || config.revision !== input.revision)
        throw new AiError("STALE_CONFIGURATION");
      if (!config.configured || !config.apiKey) return null;
      const result = await readProviderMetadata(
        "key",
        ctx,
        ctx.signal,
        undefined,
        undefined,
        input,
      );
      if (Array.isArray(result)) throw new AiError("invalid-response");
      return result;
    }),
  );
export const listAiModels = adminProcedure
  .input(
    z
      .object({ identity, kind: z.enum(["chatModels", "embeddingModels"]) })
      .strict(),
  )
  .mutation(({ ctx, input }) =>
    run(async () => {
      const result = await readProviderMetadata(
        input.kind,
        ctx,
        ctx.signal,
        undefined,
        undefined,
        input.identity,
      );
      if (!Array.isArray(result)) throw new AiError("invalid-response");
      return { models: result, at: new Date().toISOString() };
    }),
  );
