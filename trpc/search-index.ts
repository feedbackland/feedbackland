import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import {
  indexSnapshot,
  indexCounts,
  rebuildIndex,
} from "@/lib/llm/search-index";
import { checkConnection } from "@/lib/llm/onboarding";
import { probeInfo } from "@/lib/llm/embeddings";
import { usableCheckedKey } from "@/lib/llm/settings-store";
import { getConfig } from "@/lib/config";
import { dailyShare } from "@/lib/llm/usage";
export const getSearchIndex = adminProcedure.query(async ({ ctx }) => {
  const [index, counts] = await Promise.all([
    indexSnapshot(false, ctx.signal),
    indexCounts(),
  ]);
  const env = getConfig(),
    probe = probeInfo(index);
  return {
    ...counts,
    epoch: index.epoch,
    token: index.config.token,
    model: index.config.options.embeddingModel,
    dimensions: index.physical?.dimensions ?? null,
    requested: env.explicitDimensions ? env.dimensions : null,
    observed: probe?.actual ?? null,
    state:
      index.reason ??
      (!usableCheckedKey(index.config)
        ? "key-unusable"
        : (probe?.reason ?? "unverified")),
    dailyBudget: dailyShare(index.config, "backfill"),
    generation: index.fingerprint?.generation ?? null,
  };
});
export const rebuildSearchIndex = adminProcedure
  .input(
    z.object({
      epoch: z.string().regex(/^[1-9][0-9]*$/),
      token: z.string().regex(/^[0-9a-f]{64}$/),
      dimensions: z.number().int().min(1).max(4000),
      confirm: z.literal(true),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { epoch, dimensions, identity, configured } = await rebuildIndex(
      ctx,
      input,
    );
    if (!configured) return { epoch, dimensions, checked: false };
    // The rebuild committed before the provider call. Report its outcome independently.
    const check = await checkConnection(
      ctx,
      identity,
      "configure",
      ctx.signal,
    ).catch(() => null);
    return { epoch, dimensions, checked: check?.check.search === "passed" };
  });
