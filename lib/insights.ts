import type { FeedbackStatus, Insight, InsightEffort } from "@/lib/typings";

export const FEEDBACK_STATUSES = [
  "under consideration",
  "planned",
  "in progress",
  "done",
  "declined",
] as const;

export const STATUS_TEXT_CLASS: Record<
  NonNullable<FeedbackStatus>,
  string
> = {
  "under consideration": "text-under-consideration",
  planned: "text-planned",
  "in progress": "text-in-progress",
  done: "text-done",
  declined: "text-declined",
};

export const STATUS_DOT_CLASS: Record<NonNullable<FeedbackStatus>, string> = {
  "under consideration": "bg-under-consideration",
  planned: "bg-planned",
  "in progress": "bg-in-progress",
  done: "bg-done",
  declined: "bg-declined",
};

export const EFFORT_LABEL: Record<NonNullable<InsightEffort>, string> = {
  s: "Small",
  m: "Medium",
  l: "Large",
};

/** How the priority score is weighted. Shown to the admin in the score popover. */
export const SCORE_WEIGHTS = {
  reach: 0.4,
  momentum: 0.35,
  severity: 0.25,
} as const;

/** Quick wins get a nudge, large ones a small brake. */
export const EFFORT_MULTIPLIER: Record<NonNullable<InsightEffort>, number> = {
  s: 1.06,
  m: 1.0,
  l: 0.94,
};

/** Activity newer than this feeds an insight's momentum. */
export const MOMENTUM_WINDOW_DAYS = 30;

/** Days for a signal's momentum weight to halve. */
export const MOMENTUM_HALF_LIFE_DAYS = 21;

export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Extra people backing an insight since the previous run. */
export const getReachDelta = (insight: Insight): number | null => {
  const previous = insight.signals?.previous;
  if (!previous) return null;
  const delta = insight.reach - previous.reach;
  return delta > 0 ? delta : null;
};

/** Change in score since the previous run, ignoring noise-level drift. */
export const getPriorityDelta = (insight: Insight): number | null => {
  const previous = insight.signals?.previous;
  if (!previous) return null;
  const delta = insight.priority - previous.priority;
  return Math.abs(delta) >= 3 ? delta : null;
};

/**
 * A signal has to lead the other two by this much before it is worth calling
 * out. Below it the three are close enough that naming a winner would be
 * arbitrary, and the meter alone tells the story.
 */
const DRIVER_MARGIN = 12;

const DRIVER_LABEL = {
  reach: "Widely asked",
  momentum: "Surging",
  severity: "Severe",
} as const;

/**
 * The one thing carrying an insight up the list, when there is one.
 *
 * Compares the three raw component scores rather than their weighted
 * contributions: weighting reach highest would make it "win" almost every time
 * and the label would stop meaning anything.
 */
export const getSignalDriver = (insight: Insight): string | null => {
  const signals = insight.signals;
  if (!signals) return null;

  const parts = [
    { key: "reach", value: signals.reachScore },
    { key: "momentum", value: signals.momentumScore },
    { key: "severity", value: signals.severityScore },
  ] as const;

  const [top, ...rest] = [...parts].sort((a, b) => b.value - a.value);
  const restMean = rest.reduce((sum, p) => sum + p.value, 0) / rest.length;

  return top.value - restMean >= DRIVER_MARGIN ? DRIVER_LABEL[top.key] : null;
};

export const formatReach = (reach: number) =>
  `${reach} ${reach === 1 ? "person" : "people"}`;

export const formatPostCount = (count: number) =>
  `${count} ${count === 1 ? "post" : "posts"}`;
