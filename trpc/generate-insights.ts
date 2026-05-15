import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { adminProcedure } from "@/lib/trpc";
import { getAllActiveFeedbackPosts } from "@/queries/get-all-active-feedback-posts";
import { createInsightsQuery } from "@/queries/create-insights";
import type { FeedbackCategory, FeedbackStatus } from "@/lib/typings";
import { LLM_MODEL, getPlainText } from "@/lib/utils-server";

const MAX_INSIGHTS = 50;
const MAX_INPUT_POSTS = 400;
const MAX_TITLE_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 800;
const LLM_TIMEOUT_MS = 90_000;
const LLM_TEMPERATURE = 0.2;
const LLM_MAX_ATTEMPTS = 3;
const LLM_RETRY_BASE_DELAY_MS = 800;

const llmInsightSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_CHARS),
  description: z.string().trim().min(1).max(2000),
  ids: z.array(z.string().min(1)).min(1),
  priority: z.number().min(0).max(100),
});

const llmResponseSchema = z.object({
  insights: z.array(llmInsightSchema).max(MAX_INSIGHTS),
});

type LlmInsight = z.infer<typeof llmInsightSchema>;
type LlmResponse = z.infer<typeof llmResponseSchema>;

type NormalizedFeedback = {
  id: string;
  title: string;
  description: string;
  upvotes: number;
  commentCount: number;
  status: FeedbackStatus;
  category: FeedbackCategory;
};

const SYSTEM_PROMPT = `You are a senior product analyst AI. You synthesize user feedback into a strategic, prioritized product roadmap.

## Input
You receive a JSON array of feedback posts. Each post has: id, title, description, upvotes, commentCount, status, category.

## Task
Produce a roadmap of at most ${MAX_INSIGHTS} items. Each item bundles one or more posts that share the same underlying need.

## Bundling rules
- Merge aggressively when posts describe the same need. "dark mode", "night theme", "black background" → one item: "Add Dark Mode".
- Group related issues into a single fix. "login fails", "auth timeout", "can't sign in" → one item: "Fix Login Failures".
- Each post belongs to AT MOST ONE item. Never list the same id under multiple items.
- Every id you return MUST appear verbatim in the input. Do not invent, modify, or paraphrase ids.
- Posts that are pure noise (off-topic, no actionable signal) may be dropped — do not force them into an item.

## Item fields
- title: A concise, action-oriented phrase (<80 chars). E.g. "Add Dark Mode", "Fix Safari Login Failures".
- description: 1-3 sentences. State the user pain or opportunity, then the proposed direction. No fluff, no marketing language.
- ids: Array of original post ids contributing to this item.
- priority: Integer 0-100 using this rubric:
  - 90-100: Critical issues blocking core flows for many users, or overwhelming demand.
  - 70-89: High-impact items with strong engagement or clear severity.
  - 40-69: Solid improvements with moderate engagement.
  - 0-39: Lower-impact polish or niche requests.

## Prioritization signals (weighted in this order)
1. Severity — issues blocking users beat polish or new features.
2. Reach — number of bundled posts, total upvotes, total comments. More signal = higher priority.
3. Category — at equal engagement, 'issue' > 'idea' > 'general feedback'.

## Output
Return ONLY a JSON object of the form:
{"insights": [{"title": "...", "description": "...", "ids": ["..."], "priority": 90}, ...]}

Sort the array by priority descending. No prose, no markdown fences, no commentary outside the JSON.`;

const toNum = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const truncate = (s: string, max: number): string =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

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

const normalize = (
  posts: Awaited<ReturnType<typeof getAllActiveFeedbackPosts>>,
): NormalizedFeedback[] => {
  return posts
    .map((p) => {
      const title = (p.title ?? "").trim();
      const description = getPlainText(p.description ?? "").trim();
      return {
        id: p.id,
        title: truncate(title, MAX_TITLE_CHARS),
        description: truncate(description, MAX_DESCRIPTION_CHARS),
        upvotes: toNum(p.upvotes),
        commentCount: toNum(p.commentCount),
        status: p.status as FeedbackStatus,
        category: p.category as FeedbackCategory,
      };
    })
    .filter((p) => p.id && p.title.length > 0 && p.description.length > 0);
};

const selectForLLM = (posts: NormalizedFeedback[]): NormalizedFeedback[] => {
  if (posts.length <= MAX_INPUT_POSTS) return posts;
  return [...posts]
    .sort(
      (a, b) =>
        b.upvotes + b.commentCount - (a.upvotes + a.commentCount),
    )
    .slice(0, MAX_INPUT_POSTS);
};

const majority = <T>(values: Array<T | null>): T | null => {
  const counts = new Map<T, number>();
  for (const v of values) {
    if (v === null || v === undefined) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: T | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
};

const callLLM = async (
  posts: NormalizedFeedback[],
  signal: AbortSignal,
): Promise<LlmResponse> => {
  const userPrompt = `Feedback posts (${posts.length} item(s)):

${JSON.stringify(
  posts.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    upvotes: p.upvotes,
    commentCount: p.commentCount,
    status: p.status,
    category: p.category,
  })),
)}

Produce the JSON object now. Sort by priority desc. Max ${MAX_INSIGHTS} items.`;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: LLM_MODEL,
        reasoning: { exclude: true, enabled: true },
        response_format: { type: "json_object" },
        temperature: LLM_TEMPERATURE,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter HTTP ${response.status} ${response.statusText}: ${body.slice(0, 500)}`,
    );
  }

  const data = await response.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.length === 0) {
    throw new Error("LLM returned empty or malformed response body");
  }

  const cleaned = stripCodeFence(content);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `LLM content is not valid JSON: ${cleaned.slice(0, 200)}`,
    );
  }

  // Tolerate the LLM returning a bare array instead of {"insights": [...]}.
  const candidate = Array.isArray(parsed) ? { insights: parsed } : parsed;

  const result = llmResponseSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `LLM response failed schema validation: ${formatZodIssues(result.error)}`,
    );
  }

  return result.data;
};

const callLLMWithRetry = async (
  posts: NormalizedFeedback[],
): Promise<LlmResponse> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= LLM_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      return await callLLM(posts, controller.signal);
    } catch (error) {
      lastError = error;
      if (attempt < LLM_MAX_ATTEMPTS) {
        await sleep(LLM_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "unknown LLM error"));
};

const buildInsights = (
  llmInsights: LlmInsight[],
  postIndex: Map<string, NormalizedFeedback>,
) => {
  const seenIds = new Set<string>();
  const built: Array<{
    title: string;
    description: string;
    ids: string[];
    upvotes: number;
    commentCount: number;
    status: FeedbackStatus;
    category: FeedbackCategory;
    priority: number;
  }> = [];

  for (const raw of llmInsights) {
    // Drop ids that don't exist in the input, and ids already claimed by an earlier item.
    const validIds = raw.ids.filter(
      (id) => postIndex.has(id) && !seenIds.has(id),
    );

    if (validIds.length === 0) continue;

    for (const id of validIds) seenIds.add(id);

    const bundled = validIds.map((id) => postIndex.get(id)!);
    const upvotes = bundled.reduce((sum, p) => sum + p.upvotes, 0);
    const commentCount = bundled.reduce((sum, p) => sum + p.commentCount, 0);
    const status = majority(bundled.map((p) => p.status));
    const category = majority(bundled.map((p) => p.category));

    // Engagement-weighted adjustment: LLM priorities tend to cluster around the middle,
    // so a small log-scaled boost from objective signal helps separate items.
    const engagementSignal = Math.log10(
      1 + upvotes + commentCount + bundled.length * 3,
    );
    const engagementBoost = clamp(engagementSignal * 4, 0, 15);
    const categoryBoost = category === "issue" ? 5 : 0;

    const finalPriority = Math.round(
      clamp(raw.priority * 0.85 + engagementBoost + categoryBoost, 0, 100),
    );

    built.push({
      title: raw.title.trim(),
      description: raw.description.trim(),
      ids: validIds,
      upvotes,
      commentCount,
      status,
      category,
      priority: finalPriority,
    });
  }

  built.sort((a, b) => b.priority - a.priority);
  return built;
};

export const generateInsights = adminProcedure.mutation(async ({ ctx }) => {
  const rawPosts = await getAllActiveFeedbackPosts({ orgId: ctx.orgId });
  const normalized = normalize(rawPosts);

  if (normalized.length === 0) {
    await createInsightsQuery({ orgId: ctx.orgId, insights: [] });
    return true;
  }

  const selected = selectForLLM(normalized);
  const postIndex = new Map(normalized.map((p) => [p.id, p]));

  let llmResponse: LlmResponse;
  try {
    llmResponse = await callLLMWithRetry(selected);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to generate insights: ${reason}`,
      cause: error,
    });
  }

  const insights = buildInsights(llmResponse.insights, postIndex);

  if (insights.length === 0) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "LLM returned no usable insights — all referenced ids were invalid or duplicated.",
    });
  }

  await createInsightsQuery({
    orgId: ctx.orgId,
    insights: insights.map((i) => ({
      orgId: ctx.orgId,
      title: i.title,
      description: i.description,
      upvotes: i.upvotes,
      commentCount: i.commentCount,
      status: i.status,
      category: i.category,
      ids: i.ids,
      priority: i.priority,
    })),
  });

  return true;
});
