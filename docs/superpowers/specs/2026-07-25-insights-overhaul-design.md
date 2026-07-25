# Admin "Insights" Page — Ground-up Overhaul

**Date:** 2026-07-25
**Status:** Implemented
**Author:** Claude (with David)

## The name

Shipped as **"AI Roadmap"**, which over-promised in two directions. It is not a
roadmap — it owns no plan, no sequence and no commitment — and leading with
"AI" spends the tab label on an implementation detail nobody needs told in
2026. The page is now **Insights**, at `/admin/insights`.

"Insights" is generic, and that is the point: it claims observation, not
planning, which is exactly what the page does. The alternatives were worse.
"Themes" names the mechanism rather than the value. "Priorities" implies these
are the team's commitments when they are only what the data suggests — the
precise over-promise the rename exists to remove. Aligning on "Insights" also
collapses three vocabularies into one: the table has always been `insights`,
and the UI, the code and the database now agree.

The old URL redirects, so existing bookmarks keep working.

## What this page is for

One job, stated plainly:

> Tell me what to build or fix next, and let me close the loop when it's done.

It is **not** a planning board. It does not manage a roadmap, own a plan, or
model horizons. It reads the feedback, ranks what matters, shows its working,
and offers exactly one action.

## What was wrong with the old page

An audit of the original `components/app/insights/*`,
`components/app/insight/*`, `trpc/generate-insights.ts` and
`queries/{create,get}-insights.ts` found:

1. **It was a dead end.** No write path existed back into the product. You read
   the analysis and then did nothing with it, while the app's own status model
   sat one page away, untouched.
2. **Every run destroyed the last one.** `createInsightsQuery` ran
   `DELETE FROM insights WHERE orgId = ?` then inserted fresh rows with new
   UUIDs. Nothing could attach to an insight — not a delta, not "this is new
   since last week". The most valuable output of a recurring analysis, *what
   changed*, was structurally impossible.
3. **The status badge was a lie.** `status = majority(bundled posts' statuses)`
   — the modal value of an unrelated field, presented as the insight's own state.
4. **Priority was unexplainable.** `round(llm × 0.85 + engagementBoost + categoryBoost)`,
   collapsed to four fuzzy words. Nobody could say why an item scored 62, and in
   practice almost everything landed between 40 and 70.
5. **Recency was thrown away.** `createdAt` was selected and then dropped in
   `normalize()`. A surge last week ranked identically to a trickle over years.
6. **Demand was double-counted.** A theme's `upvotes` summed its posts' upvote
   counts, so one person upvoting three duplicates read as three people. The
   `user_upvote` table, which has both `userId` and `createdAt`, was untouched.
7. **Filtering and sorting were wrong** — applied client-side over whichever 20
   rows had paged in, so "sort by upvotes" reordered the top-20-by-priority.
8. **400 posts, silently.** Boards above the cap had the rest dropped with no
   indication, and the cutoff ranked by raw engagement, favouring old posts.
9. **Coverage was invisible.** The old screenshots show three consecutive items
   each "Based on 1 feedback post" — the clustering, which is the whole value
   proposition, had barely done anything, and nothing said so.
10. **It could not finish on Vercel** (90s × 3 attempts, no `maxDuration`), and
    regenerating blanked the page first, so a failure left you with nothing.
11. **Low density, no hierarchy.** 50 identical cards at `space-y-6`; the top
    item looked exactly like the 37th. Roughly three fit on a screen.
12. `insight_reports` was written and never read. Dead table.

## The three ideas it is built on

**1. Insights persist; they are not regenerated from scratch.** A new run
matches its clusters to the existing rows by post-id overlap and updates them in
place. That is what makes "+9 people since the last run" and the NEW badge
possible, and what makes Regenerate safe to press.

**2. The model does semantics; arithmetic does ranking.** LLMs are excellent at
grouping and articulating and unreliable at scoring. The model returns clusters,
titles, descriptions, evidence, effort and *severity* (a judgement about
the problem, which it can make); the server computes priority from real data.
The result is reproducible, auditable, and showable — trust in an AI feature
comes from legibility. What the row shows is not the arithmetic but its
consequence: how strong the signal is, and which part of it is doing the work.

**3. Exactly one action.** When an insight is dealt with, set the status of all
its feedback at once. Nothing else. No horizons, no lanes, no dismiss, no
triage state of its own.

## The page

```
Insights                                                    [⟳ Regenerate]
84 posts → 19 insights · 6 new · 5 not grouped · 2 hours ago  ← run strip (popover)

┌──────────────────────────────────────────────────────────────────────────┐
│  Fix Safari login failures                          Widely asked  ▁▂▃▄▅  │
│  Users on Safari 17 are signed out part-way through a session and        │
│  lose unsaved work.                                                      │
│  34 people · ↗+9 · 12 posts ⌄                      [● In progress ▾]     │
├──────────────────────────────────────────────────────────────────────────┤
│  Let people export a board to CSV                        Surging  ▁▂▃▄▁  │
├──────────────────────────────────────────────────────────────────────────┤
│  Make search find partial and near matches      NEW               ▁▂▃▁▁  │
└──────────────────────────────────────────────────────────────────────────┘
```

Three controls per row, each doing one job:

- **The signal meter** — five rising bars, filled by priority. Read down the
  right edge and the list's falloff is obvious with no scale to learn. Beside it
  a single word appears *only* when one of the three components clearly leads
  the other two (by ≥ 12 points): "Widely asked", "Surging" or "Severe". So most
  rows show the meter alone, and when a word does appear it means something.
  Clicking opens the breakdown — reach, momentum and severity as bars with
  values, the score itself, and the change since the last run.
- **The post count is the disclosure.** Clicking "12 posts" shows the feedback
  behind the insight. The number is the way in to the things it counts, so no
  extra control is needed.
- **The status control** applies one status to every post behind the insight.
  Same five statuses, same colours and same menu shape as the per-post status
  menu, so there is nothing new to learn.

There are no rank numerals — the list is sorted, so position already says it —
and no sort control, because offering four orderings would say we don't know
which one matters. Search appears only once there are eight or more insights.

### Why the score is not a number

`87` out of 100 is unreadable without a scale, and it was precision theatre:
across three consecutive runs on the same unchanged board the same insight
scored 86, 83 and 87. Two significant figures implied a stability the data does
not have.

The meter fixes the first problem — magnitude becomes relative and instant, and
quantising to five levels stops run-to-run drift from being visible at all. The
driver word fixes the second: it answers "why is this one up here", which is
what the number was standing in for. The exact figure still exists and is still
shown, one click away, where the arithmetic that produced it is shown with it.

The meta line carries three facts and nothing else: how many distinct people
are behind it, whether that grew since the last run, and the way in to the
evidence. Effort still shapes the score and is explained in the popover, but it
is not repeated on the row; the imperative title already says whether something
is a fix or a feature, so a separate label for that was redundant.

## Scoring

The model returns `severity` (0–100, about the problem, explicitly *not* about
demand — asking it to weigh demand and then weighing demand again in code is
what produced the old double-count). The server computes the rest:

```
reach     = distinct people who upvoted or authored any post in the insight
            (floor: one voice per post, for anonymous API-fed boards)
momentum  = Σ posts 2·2^(-age/21d) + Σ upvotes 2^(-age/21d) + comments in 30d

priority  = (0.40·reach + 0.35·momentum + 0.25·severity) × effort
            effort: s ×1.06, m ×1.00, l ×0.94
```

`reach` and `momentum` are normalised against the strongest insight in the same
run — ranking is inherently relative, and this is what stops every score
collapsing into the middle. Every input is stored in `signals` so the popover
shows the derivation.

## Continuity between runs

1. Cluster the current open posts.
2. Match each cluster against the existing rows by post-id overlap (Jaccard
   ≥ 0.30, or ≥ 2 shared posts with ≥ 0.60 containment). Strongest pairs win
   first, one-to-one.
3. **Matched** → updated in place. `firstSeenAt` is never touched; the previous
   priority/reach/postCount move into `signals.previous`, which is where the
   deltas come from. Only a previous run that scored the same way is compared
   against, so an upgrade never reads as a surge in demand.
4. **Unmatched new** → inserted. `firstSeenAt == lastSeenAt` is what NEW means.
5. **Existing, unmatched** → archived, not deleted. Since done and declined
   posts are excluded from the input, marking an insight done makes it drop off
   the list by itself on the next run.

Model temperature is 0.2, which keeps titles stable enough for matching to hold.

## Status is read, never stored

`getRoadmapQuery` rolls each insight's status up from the live feedback posts on
every read: unanimous → that status, disagreeing → "Mixed", none → "Set status".
Nothing is cached on the insight row, so it cannot drift from what the board
actually says — which is precisely how the old majority-vote badge went wrong.

The bulk update writes no status-change comments, so setting a status on twelve
posts does not flood the activity feed.

## Scale and honesty

- Posts are analysed in **parallel chunks of 200, up to 1000**, then a merge
  pass consolidates cross-chunk duplicates. The merge model returns only
  *groupings of indexes* — the merge happens in code, so it cannot invent
  content — and a failed merge degrades to "keep both" rather than failing the
  run. A failed chunk is dropped, not fatal.
- Over-budget boards are trimmed by engagement **plus a recency bonus**.
- `insight_reports` is now the run log behind the coverage strip: posts read of
  posts available, insights produced, posts that fit no grouping, new insights,
  insights that dropped off, and the model used.

## Files

| File | Change |
|---|---|
| `db/schema.sql`, `db/migrations/2026-07-25-insights.sql` | Additive columns on `insights` + `insight_reports`, three indexes, a `firstSeenAt` backfill so pre-existing rows don't read as NEW. |
| `db/schema.ts` | Kysely types for the new columns. |
| `lib/roadmap.ts` | Status colour maps, kind/effort labels, score weights, delta helpers. Shared by client and server. |
| `lib/typings.ts`, `lib/schemas.ts` | `RoadmapTheme`, `ThemeSignals`, `RoadmapRun`, `Roadmap`, kind/effort enums. Numerics parsed at the query boundary, not in every component. |
| `queries/get-roadmap-inputs.ts` | Posts, per-upvote rows, recent comment counts, board total. Excludes status-change comments from both counts. |
| `queries/get-roadmap.ts` | Whole roadmap + latest run + live status rollup. |
| `queries/save-roadmap.ts` | The update/insert/archive transaction. |
| `queries/set-theme-status.ts` | The one write: bulk status onto an insight's posts. |
| `trpc/generate-roadmap.ts`, `get-roadmap.ts`, `set-theme-status.ts` | Replace `generate-insights` / `get-insights`. |
| `app/api/trpc/[trpc]/route.ts` | `maxDuration = 300`. |
| `components/app/roadmap/*` | 10 focused files replacing `insights/*` + `insight/*`. |
| `hooks/use-roadmap.ts`, `use-generate-roadmap.ts`, `use-set-theme-status.ts` | Replace `use-insights` / `use-all-insights`. |
| `lib/atoms.ts`, `components/app/global-org-state` | `expandedThemesAtom`; the reset hook checked for a route named `insights` that has not existed. |
| `lib/utils.ts` | `getPriority{Label,Level,Color}` deleted. |

## Deliberately not built

- **No roadmap management.** No Now/Next/Later, no lanes, no drag ordering, no
  dismiss. The page reports; it does not own a plan. Adding that later is a
  clean extension, not a rewrite.
- **No sort control.** The ranking is the product.
- **No table rename.** `insights` stays. Renaming a table in a self-hosted OSS
  app buys nothing a user can see and costs every self-hoster a risky migration.
  The word in the UI is "insight".
- **No automatic generation on a schedule.** It needs a job runner the project
  does not have. The README no longer claims it happens.
- **No pagination.** Capped at 60 insights. Paging is what made the old sorting
  wrong.
- **No PDF export.** The old page had one; it served sharing, not deciding, and
  it carried `@react-pdf/renderer` (a heavy dependency, now removed) for a
  single icon button. It was the only export in the product, so the README's
  "export feedback" claim went with it.

## Verification

- `npx tsc --noEmit` — clean (one pre-existing unrelated error in
  `components/app/settings/logo.tsx`).
- `npm run build` — compiles and generates all routes. The default run then
  fails inside Next 16's TypeScript-setup detection, which is pre-existing and
  unrelated (the project pins `typescript@7.0.2` + `@typescript/typescript6`);
  with `typescript.ignoreBuildErrors` the build completes end to end.
- Migration applied to the live Supabase database; re-run clean.
- Generation exercised repeatedly against a real board through the real server
  path (tRPC caller → queries → Postgres → OpenRouter), confirming: matched
  insights keep their row id across runs; `previous` populates from the prior
  run only; the coverage strip's "not grouped" count is accurate (the three
  posts it refused to group were "Unclear input provided", "Just testing the
  system", "Unclear input provided"); setting a status writes to every post
  behind the insight and the rollup reflects it immediately; clearing it works.
  All test data was restored to its exact pre-test state.
- Rendered against a temporary mock harness and reviewed in light and dark mode
  at the real 1024px content width: header, run strip, rows, score popover,
  status menu, expanded evidence, and the first-run empty state.

Two bugs were found by the live run and fixed:

1. The clustering prompt listed every field except `ids`, and gave no output
   shape, so the model returned insights with no post ids and every run failed
   validation. Fixed by naming `ids` as required and showing an output example.
2. `jsonb_build_object('dismissedAt', $1)` failed with *"could not determine
   data type of parameter"* — Postgres cannot infer a bound parameter's type
   from that function's polymorphic signature. (That code has since been removed
   along with dismissal, but the same trap applies to any `sql` template that
   passes a parameter into a polymorphic function.)

Not verified: the assembled page behind admin auth, which needs a signed-in
session. Every component it composes was verified separately.
