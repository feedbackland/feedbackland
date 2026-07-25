import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { adminProcedure } from "@/lib/trpc";
import { getInsightsInputs } from "@/queries/get-insights-inputs";
import {
  getExistingInsightsQuery,
  saveInsightsQuery,
  type InsightWrite,
} from "@/queries/save-insights";
import type {
  FeedbackCategory,
  InsightEffort,
  InsightSignals,
} from "@/lib/typings";
import {
  EFFORT_MULTIPLIER,
  MOMENTUM_HALF_LIFE_DAYS,
  MOMENTUM_WINDOW_DAYS,
  SCORE_WEIGHTS,
  clamp,
} from "@/lib/insights";
import { LLM_MODEL, getPlainText } from "@/lib/utils-server";

const CHUNK_SIZE = 200;
const MAX_CHUNKS = 5;
const MAX_POSTS = CHUNK_SIZE * MAX_CHUNKS;
const MAX_INSIGHTS = 60;
const MAX_TITLE_CHARS = 160;
const MAX_DESCRIPTION_CHARS = 700;

const CLUSTER_TIMEOUT_MS = 90_000;
const MERGE_TIMEOUT_MS = 45_000;
const LLM_MAX_ATTEMPTS = 2;
const LLM_RETRY_DELAY_MS = 1_000;

/** Post-id overlap above which two clusters are considered the same insight. */
const MATCH_JACCARD = 0.3;
const MATCH_CONTAINMENT = 0.6;

// ---------------------------------------------------------------------------
// Model contract
// ---------------------------------------------------------------------------

const clusterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  evidence: z.string().trim().max(600).optional(),
  ids: z.array(z.string().min(1)).min(1),
  effort: z.enum(["s", "m", "l"]).optional(),
  severity: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1).optional(),
});

const clusterResponseSchema = z.object({
  insights: z.array(clusterSchema).max(MAX_INSIGHTS),
});

const mergeResponseSchema = z.object({
  groups: z.array(z.array(z.number().int().min(0)).min(2)).max(MAX_INSIGHTS),
});

type Cluster = z.infer<typeof clusterSchema>;

const CLUSTER_PROMPT = `You are a product analyst. You turn raw user feedback into insights a product team can act on.

## Input
A JSON array of feedback posts. Each has: id, title, description, category, ageDays.

## Your job
Group the posts into insights. An insight is one underlying need, however many different ways users described it.

Group hard:
- "dark mode", "night theme", "black background" is ONE insight.
- "login fails", "auth times out", "can't sign in on Safari" is ONE insight.
- An insight built from a single post is allowed only when genuinely nothing else relates to it.

Rules:
- Every id you return must appear verbatim in the input. Never invent, edit, or paraphrase an id.
- A post belongs to at most one insight.
- Leave out posts that carry no actionable signal rather than forcing them into an insight.

## Fields for each insight
- ids: array of the input post ids that make up this insight. Required on every insight, never empty.
- title: what to do, as an imperative phrase under 70 characters. "Fix Safari login failures", not "Login issues".
- description: 1-3 plain sentences. The user's problem first, then the direction you would take. No marketing language.
- evidence: one sentence under 160 characters describing what users actually said, in their terms.
- effort: "s", "m" or "l" — your rough sense of the build size.
- severity: 0-100, how much damage the unaddressed problem does to a user who hits it.
  - 90-100: users are blocked, or losing work or money.
  - 70-89: a core flow is painful or unreliable.
  - 40-69: a real but survivable annoyance.
  - 0-39: polish, or a nice-to-have.
  Judge the problem itself. Do NOT factor in how many people asked — demand is counted from the data separately, and counting it twice would distort the ranking.
- confidence: 0-1, how sure you are that these posts really are one insight.

## Output
Return only a JSON object shaped exactly like this, with no prose, no markdown fences and no commentary:

{"insights": [
  {"ids": ["<input id>", "<input id>"], "title": "Fix Safari login failures", "description": "...", "evidence": "...", "effort": "m", "severity": 82, "confidence": 0.9}
]}`;

const MERGE_PROMPT = `You are consolidating product insights that were derived independently from different batches of the same feedback, so some describe the same underlying need in different words.

## Input
A JSON array of insights, each with: index, title, description.

## Your job
Return the groups of indexes that describe the SAME underlying need.

- Group only what a product team would build as one piece of work.
- Do not group merely related things: "improve search" and "add filters" stay apart.
- Omit any index that stands alone. Most indexes will be omitted.
- Never place an index in more than one group.

## Output
Return only a JSON object: {"groups": [[0, 7], [3, 11, 12]]}. No prose, no markdown fences.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toNum = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const truncate = (s: string, max: number): string =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const stripCodeFence = (s: string): string =>
  s
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

const formatZodIssues = (error: z.ZodError): string =>
  error.issues
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("; ");

const daysBetween = (from: Date, to: Date) =>
  Math.max(0, (to.getTime() - from.getTime()) / 86_400_000);

/** Half-life decay: a signal is worth half as much every HALF_LIFE days. */
const decay = (ageDays: number) => 2 ** (-ageDays / MOMENTUM_HALF_LIFE_DAYS);

const majority = <T>(values: Array<T | null>): T | null => {
  const counts = new Map<T, number>();
  for (const value of values) {
    if (value === null || value === undefined) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

// ---------------------------------------------------------------------------
// Normalised input
// ---------------------------------------------------------------------------

type Upvoter = { userId: string; createdAt: Date };

type PostMetrics = {
  id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  createdAt: Date;
  authorId: string | null;
  upvotes: number;
  commentCount: number;
  recentCommentCount: number;
  upvoters: Upvoter[];
};

const buildPostMetrics = (
  inputs: Awaited<ReturnType<typeof getInsightsInputs>>,
): PostMetrics[] => {
  const upvotersByPost = new Map<string, Upvoter[]>();

  for (const row of inputs.upvotes) {
    const list = upvotersByPost.get(row.contentId);
    const entry = { userId: row.userId, createdAt: row.createdAt };
    if (list) list.push(entry);
    else upvotersByPost.set(row.contentId, [entry]);
  }

  return inputs.posts
    .map((post) => ({
      id: post.id,
      title: truncate((post.title ?? "").trim(), MAX_TITLE_CHARS),
      // Left as stored HTML here and converted only for the posts that are
      // actually sent to the model — stripping markup from a whole board's
      // worth of descriptions to then discard most of them is wasted work.
      description: post.description ?? "",
      category: post.category,
      createdAt: post.createdAt,
      authorId: post.authorId,
      upvotes: toNum(post.upvotes),
      commentCount: toNum(post.commentCount),
      recentCommentCount: toNum(post.recentCommentCount),
      upvoters: upvotersByPost.get(post.id) ?? [],
    }))
    .filter((post) => post.id && post.title.length > 0);
};

/**
 * When a board is larger than the model budget, keep the posts most likely to
 * matter: engagement plus a recency bonus. Engagement alone would quietly
 * favour old posts purely because they have had longer to collect upvotes.
 */
const selectForAnalysis = (posts: PostMetrics[], now: Date): PostMetrics[] => {
  if (posts.length <= MAX_POSTS) return posts;

  const weight = (post: PostMetrics) =>
    post.upvotes +
    post.commentCount * 2 +
    12 * decay(daysBetween(post.createdAt, now));

  return [...posts].sort((a, b) => weight(b) - weight(a)).slice(0, MAX_POSTS);
};

// ---------------------------------------------------------------------------
// Model calls
// ---------------------------------------------------------------------------

const callModel = async ({
  system,
  user,
  signal,
}: {
  system: string;
  user: string;
  signal: AbortSignal;
}): Promise<unknown> => {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: LLM_MODEL,
      // Low temperature keeps insight titles stable between runs, which is what
      // lets the same insight be recognised and keep its decision.
      temperature: 0.2,
      reasoning: { exclude: true, enabled: true },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter HTTP ${response.status} ${response.statusText}: ${body.slice(0, 500)}`,
    );
  }

  const data = await response.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.length === 0) {
    throw new Error("The model returned an empty response");
  }

  const cleaned = stripCodeFence(content);

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`The model returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
};

const withRetry = async <T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= LLM_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await run(controller.signal);
    } catch (error) {
      lastError = error;
      if (attempt < LLM_MAX_ATTEMPTS) await sleep(LLM_RETRY_DELAY_MS);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "unknown model error"));
};

const clusterChunk = async (
  posts: PostMetrics[],
  now: Date,
): Promise<Cluster[]> => {
  const payload = posts.map((post) => ({
    id: post.id,
    title: post.title,
    description: truncate(
      getPlainText(post.description).trim(),
      MAX_DESCRIPTION_CHARS,
    ),
    category: post.category,
    ageDays: Math.round(daysBetween(post.createdAt, now)),
  }));

  const parsed = await withRetry(
    (signal) =>
      callModel({
        system: CLUSTER_PROMPT,
        user: `Feedback posts (${payload.length}):\n\n${JSON.stringify(payload)}\n\nReturn the JSON object now.`,
        signal,
      }),
    CLUSTER_TIMEOUT_MS,
  );

  // Tolerate a bare array in place of {"insights": [...]}.
  const candidate = Array.isArray(parsed) ? { insights: parsed } : parsed;
  const result = clusterResponseSchema.safeParse(candidate);

  if (!result.success) {
    throw new Error(
      `The model's insights failed validation: ${formatZodIssues(result.error)}`,
    );
  }

  return result.data.insights;
};

/**
 * Chunks are clustered blind to each other, so the same need can surface twice.
 * This pass only returns groupings of indexes — the merge itself is done in
 * code, so the model cannot invent content here.
 */
const mergeAcrossChunks = async (clusters: Cluster[]): Promise<Cluster[]> => {
  if (clusters.length < 2) return clusters;

  const payload = clusters.map((cluster, index) => ({
    index,
    title: cluster.title,
    description: truncate(cluster.description, 300),
  }));

  let groups: number[][] = [];

  try {
    const parsed = await withRetry(
      (signal) =>
        callModel({
          system: MERGE_PROMPT,
          user: `Insights (${payload.length}):\n\n${JSON.stringify(payload)}\n\nReturn the JSON object now.`,
          signal,
        }),
      MERGE_TIMEOUT_MS,
    );

    const result = mergeResponseSchema.safeParse(parsed);
    if (result.success) groups = result.data.groups;
  } catch {
    // Consolidation is an improvement, not a requirement. A board that ends up
    // with two near-duplicate insights is far better than a failed run.
    return clusters;
  }

  const claimed = new Set<number>();
  const merged: Cluster[] = [];

  for (const group of groups) {
    const members = group
      .filter((index) => index >= 0 && index < clusters.length)
      .filter((index) => !claimed.has(index));

    if (members.length < 2) continue;
    members.forEach((index) => claimed.add(index));

    // Keep the most severe member's wording; union everything measurable.
    const parts = members.map((index) => clusters[index]);
    const lead = parts.reduce((a, b) => (b.severity > a.severity ? b : a));

    merged.push({
      title: lead.title,
      description: lead.description,
      evidence: lead.evidence,
      effort: parts.some((p) => p.effort === "l")
        ? "l"
        : parts.some((p) => p.effort === "m")
          ? "m"
          : lead.effort,
      ids: Array.from(new Set(parts.flatMap((p) => p.ids))),
      severity: Math.max(...parts.map((p) => p.severity)),
      confidence: Math.min(...parts.map((p) => p.confidence ?? 0.7)),
    });
  }

  clusters.forEach((cluster, index) => {
    if (!claimed.has(index)) merged.push(cluster);
  });

  return merged;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

type ScoredInsight = {
  cluster: Cluster;
  postIds: string[];
  posts: PostMetrics[];
  reach: number;
  momentumRaw: number;
  recentPostCount: number;
  recentUpvotes: number;
  recentCommentCount: number;
  upvotes: number;
  commentCount: number;
  latestActivityAt: Date | null;
};

const measure = (
  cluster: Cluster,
  postIndex: Map<string, PostMetrics>,
  claimed: Set<string>,
  now: Date,
): ScoredInsight | null => {
  const postIds = cluster.ids.filter(
    (id) => postIndex.has(id) && !claimed.has(id),
  );

  if (postIds.length === 0) return null;

  const posts = postIds.map((id) => postIndex.get(id)!);

  // Distinct people, not summed upvote counts: one user upvoting three
  // duplicates of the same request is one person asking.
  const people = new Set<string>();
  let momentumRaw = 0;
  let recentPostCount = 0;
  let recentUpvotes = 0;
  let recentCommentCount = 0;
  let upvotes = 0;
  let commentCount = 0;
  let latestActivityAt: Date | null = null;

  const touch = (date: Date) => {
    if (!latestActivityAt || date > latestActivityAt) latestActivityAt = date;
  };

  for (const post of posts) {
    if (post.authorId) people.add(post.authorId);

    const postAge = daysBetween(post.createdAt, now);
    momentumRaw += 2 * decay(postAge);
    if (postAge <= MOMENTUM_WINDOW_DAYS) recentPostCount += 1;
    touch(post.createdAt);

    for (const upvoter of post.upvoters) {
      people.add(upvoter.userId);
      const age = daysBetween(upvoter.createdAt, now);
      momentumRaw += decay(age);
      if (age <= MOMENTUM_WINDOW_DAYS) recentUpvotes += 1;
      touch(upvoter.createdAt);
    }

    momentumRaw += post.recentCommentCount;
    recentCommentCount += post.recentCommentCount;
    upvotes += post.upvotes;
    commentCount += post.commentCount;

  }

  return {
    cluster,
    postIds,
    posts,
    // Anonymous boards (API submissions with no author and no upvotes) would
    // otherwise score zero reach, so every post counts as at least one voice.
    reach: Math.max(people.size, postIds.length),
    momentumRaw,
    recentPostCount,
    recentUpvotes,
    recentCommentCount,
    upvotes,
    commentCount,
    latestActivityAt,
  };
};

// ---------------------------------------------------------------------------
// Continuity between runs
// ---------------------------------------------------------------------------

type ExistingInsight = Awaited<ReturnType<typeof getExistingInsightsQuery>>[number];

const overlapScores = (a: Set<string>, b: Set<string>) => {
  let intersection = 0;
  for (const id of a) if (b.has(id)) intersection += 1;
  const union = a.size + b.size - intersection;
  return {
    intersection,
    jaccard: union > 0 ? intersection / union : 0,
    containment: intersection / Math.max(1, Math.min(a.size, b.size)),
  };
};

const isMatch = (scores: ReturnType<typeof overlapScores>) =>
  scores.jaccard >= MATCH_JACCARD ||
  (scores.intersection >= 2 && scores.containment >= MATCH_CONTAINMENT);

/**
 * Pairs freshly generated insights with the ones already on the board by how
 * much their feedback overlaps. Strongest pairs win first, one-to-one, so an
 * insight keeps its identity — and therefore its history and its deltas — even
 * when its wording or its posts have shifted.
 */
const matchToExisting = (
  scored: ScoredInsight[],
  existing: ExistingInsight[],
): Map<number, ExistingInsight> => {
  const newSets = scored.map((insight) => new Set(insight.postIds));
  const oldSets = existing.map((insight) => new Set(insight.ids ?? []));

  const candidates: Array<{
    newIndex: number;
    oldIndex: number;
    jaccard: number;
  }> = [];

  newSets.forEach((newSet, newIndex) => {
    oldSets.forEach((oldSet, oldIndex) => {
      const scores = overlapScores(newSet, oldSet);
      if (isMatch(scores)) {
        candidates.push({ newIndex, oldIndex, jaccard: scores.jaccard });
      }
    });
  });

  candidates.sort((a, b) => b.jaccard - a.jaccard);

  const pairs = new Map<number, ExistingInsight>();
  const usedOld = new Set<number>();

  for (const candidate of candidates) {
    if (pairs.has(candidate.newIndex) || usedOld.has(candidate.oldIndex)) {
      continue;
    }
    pairs.set(candidate.newIndex, existing[candidate.oldIndex]);
    usedOld.add(candidate.oldIndex);
  }

  return pairs;
};

const readSignals = (insight: ExistingInsight): Record<string, unknown> | null => {
  const signals = insight.signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) {
    return null;
  }
  return signals as Record<string, unknown>;
};

const hasSignals = (insight: ExistingInsight) => readSignals(insight) !== null;

const previousPostCount = (insight: ExistingInsight) =>
  toNum(readSignals(insight)?.postCount);

// ---------------------------------------------------------------------------
// Procedure
// ---------------------------------------------------------------------------

export const generateInsights = adminProcedure.mutation(async ({ ctx }) => {
  const now = new Date();
  const inputs = await getInsightsInputs({ orgId: ctx.orgId });
  const allPosts = buildPostMetrics(inputs);

  if (allPosts.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "There is no open feedback to analyse yet. Collect some feedback first.",
    });
  }

  const analysed = selectForAnalysis(allPosts, now);
  const postIndex = new Map(analysed.map((post) => [post.id, post]));

  // Chunks run concurrently; a chunk that fails after its retries is dropped
  // rather than failing the whole run, and the run log says how many posts
  // actually made it through.
  const chunks = chunk(analysed, CHUNK_SIZE);
  const settled = await Promise.allSettled(
    chunks.map((batch) => clusterChunk(batch, now)),
  );

  const succeeded = settled.filter(
    (result): result is PromiseFulfilledResult<Cluster[]> =>
      result.status === "fulfilled",
  );

  if (succeeded.length === 0) {
    const firstRejection = settled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    const reason =
      firstRejection?.reason instanceof Error
        ? firstRejection.reason.message
        : String(firstRejection?.reason ?? "unknown error");

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Could not analyse your feedback: ${reason}`,
    });
  }

  const postsAnalyzed = chunks
    .filter((_, index) => settled[index].status === "fulfilled")
    .reduce((sum, batch) => sum + batch.length, 0);

  const rawClusters = succeeded
    .flatMap((result) => result.value)
    .sort((a, b) => b.ids.length - a.ids.length)
    .slice(0, MAX_INSIGHTS * 3);

  const clusters =
    chunks.length > 1 ? await mergeAcrossChunks(rawClusters) : rawClusters;

  // Measure before ranking: a post belongs to the first insight that claims it.
  const claimed = new Set<string>();
  const scored: ScoredInsight[] = [];

  for (const cluster of clusters) {
    const measured = measure(cluster, postIndex, claimed, now);
    if (!measured) continue;
    measured.postIds.forEach((id) => claimed.add(id));
    scored.push(measured);
  }

  if (scored.length === 0) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "The analysis produced no usable insights. Try again — if it keeps happening, your feedback may be too sparse to group.",
    });
  }

  const existing = await getExistingInsightsQuery({ orgId: ctx.orgId });
  const matches = matchToExisting(scored, existing);

  // Reach and momentum are ranked relative to the strongest insight in this run,
  // which is what stops every score from clustering in the middle.
  const maxReach = Math.max(...scored.map((insight) => insight.reach), 1);
  const maxMomentum = Math.max(
    ...scored.map((insight) => insight.momentumRaw),
    0.0001,
  );

  const writes: InsightWrite[] = [];

  scored.forEach((insight, index) => {
    const match = matches.get(index);
    const { cluster } = insight;
    const effort: InsightEffort = cluster.effort ?? null;
    const effortMultiplier = effort ? EFFORT_MULTIPLIER[effort] : 1;

    const reachScore = (100 * insight.reach) / maxReach;
    const momentumScore = (100 * insight.momentumRaw) / maxMomentum;
    const severityScore = clamp(cluster.severity, 0, 100);

    const priority = Math.round(
      clamp(
        (SCORE_WEIGHTS.reach * reachScore +
          SCORE_WEIGHTS.momentum * momentumScore +
          SCORE_WEIGHTS.severity * severityScore) *
          effortMultiplier,
        0,
        100,
      ),
    );

    const signals: InsightSignals = {
      reachScore: Math.round(reachScore),
      momentumScore: Math.round(momentumScore),
      severityScore: Math.round(severityScore),
      effortMultiplier,
      postCount: insight.postIds.length,
      upvotes: insight.upvotes,
      commentCount: insight.commentCount,
      reach: insight.reach,
      recentPostCount: insight.recentPostCount,
      recentUpvotes: insight.recentUpvotes,
      recentCommentCount: insight.recentCommentCount,
      latestActivityAt: insight.latestActivityAt?.toISOString() ?? null,
      evidence: cluster.evidence?.trim() ?? "",
      confidence: cluster.confidence ?? 0.7,
      // Only compare against a run that scored the same way. An insight carried
      // over from before this scoring existed would otherwise report its
      // upgrade as a huge jump in demand.
      previous:
        match && hasSignals(match)
          ? {
              priority: toNum(match.priority),
              reach: toNum(match.reach),
              postCount: previousPostCount(match),
              at: match.lastSeenAt.toISOString(),
            }
          : null,
    };

    writes.push({
      existingId: match?.id ?? null,
      title: cluster.title.trim(),
      description: cluster.description.trim(),
      ids: insight.postIds,
      priority,
      reach: insight.reach,
      momentum: Math.round(momentumScore),
      upvotes: insight.upvotes,
      commentCount: insight.commentCount,
      category: majority(insight.posts.map((post) => post.category)),
      effort,
      signals,
    });
  });

  writes.sort((a, b) => b.priority - a.priority);
  const kept = writes.slice(0, MAX_INSIGHTS);

  const keptIds = new Set(
    kept
      .map((write) => write.existingId)
      .filter((id): id is string => id !== null),
  );

  const archiveIds = existing
    .filter((insight) => !insight.isArchived && !keptIds.has(insight.id))
    .map((insight) => insight.id);

  const postsClustered = kept.reduce((sum, write) => sum + write.ids.length, 0);

  await saveInsightsQuery({
    orgId: ctx.orgId,
    insights: kept,
    archiveIds,
    run: {
      postsTotal: inputs.postsTotal,
      postsAnalyzed,
      postsClustered,
      insightCount: kept.length,
      newInsightCount: kept.filter((write) => !write.existingId).length,
      archivedInsightCount: archiveIds.length,
      model: LLM_MODEL,
    },
  });

  return true;
});
