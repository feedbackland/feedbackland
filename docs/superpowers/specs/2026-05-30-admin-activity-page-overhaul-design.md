# Admin "Activity" Page — Overhaul Design

**Date:** 2026-05-30
**Status:** Proposed
**Author:** Claude (with David)

## Goal

Overhaul the admin Activity page — the admin's triage inbox and default landing
page — so it lets an admin **see what's new and act on it as efficiently as
possible**. Keep the existing strengths (unified posts+comments stream,
seen/unseen model, semantic search, per-item actions) and fix the structural
problems holding it back: signal-to-noise, fragmented filtering, low row
density, and inconsistency with the platform's more polished pages.

The redesign follows the Feedbackland philosophy: shadcn-first, "less is more",
no bloat. The net effect is **fewer UI elements doing more work**, denser and
richer rows, and one coherent filter control instead of three.

## Non-goals

- No database schema changes. (`activity_seen`, `feedback`, `comment` untouched.)
- No realtime/websocket updates (still fetch-on-load + cache invalidation).
- No date-bucket grouping ("Today / This week") — the sort can be
  non-chronological (upvotes/comments), so buckets would be inconsistent. YAGNI.
- No "mark as unread" (un-seeing requires deleting `activity_seen` rows; not a
  triage need). Only "mark as read" is added.
- No bulk multi-select / batch actions beyond the existing "Mark all as read".
- No author-role ("Admin" vs user) badge in the feed — kept lean; the role
  badge stays where it matters (comment threads).
- No changes to the shared `FeedbackPostOptionsMenu` / `CommentsOptionsMenu`
  (they're used on other pages); activity-specific affordances live in the row.

## Problems being fixed (from the audit)

1. **Status-change noise.** Every status change writes an
   `"Updated status to …"` comment (`hooks/use-update-status.ts:19`). These
   flood the feed and inflate the Comments count. (A filter for them already
   sits commented-out in the query.)
2. **"What's new" is subordinate.** Stat cards lead with totals; "new" is a
   small `(N new)`. There is no way to filter to **unseen only** — the #1
   triage need.
3. **Three filter mechanisms.** Category = four large clickable cards; status +
   sort = a dropdown; search = a hidden expanding icon. Three paradigms, three
   places; the cards alone consume large vertical space for four numbers.
4. **Inconsistency.** Pagination here vs. infinite scroll everywhere else;
   icon-only "mark all read" vs. labeled buttons elsewhere; ad-hoc empty/error
   text vs. the shared `<Empty>` / `<Error>` components.
5. **Low density / missing context.** Tall rows (4-line previews); author never
   shown; `upvotes` and `commentCount` are fetched but never displayed; comments
   render the parent post's title as their own heading (confusing hierarchy).

## Page anatomy (top to bottom)

```
Activity                                      [✓ Mark all as read]   ← header
5 new since you last looked                                          ← subtitle

[ All 12 ][ Ideas 4• ][ Issues 3 ][ General 3 ][ Comments 2• ]      ← segmented filter (counts + unseen dot)
Unseen only ○                          [ Newest ▾ ]  [ 🔍 Search ]   ← controls row
┌──────────────────────────────────────────────────────────────┐   ← list card
┃ 💡 Idea · under consideration                       7d   ⋯   │   ← UNSEEN: left accent bar + bold title
┃ Make search more powerful                                     │
┃ It would be great if search could find relevant results…      │
┃ (J) Jane Doe · ▲ 12 · 💬 3                                    │
├──────────────────────────────────────────────────────────────┤
│ 💬 Comment · "Add a dark mode option"               7d   ⋯   │   ← SEEN: no accent, normal weight
│ dark mode would be great.                                     │
│ (J) John Smith · ▲ 2                                          │
└──────────────────────────────────────────────────────────────┘
                  ↓ auto-loads more on scroll
```

### 1. Header (`header.tsx`)

- Title `Activity` — `<h2 className="h5">` (= `text-lg font-semibold tracking-tight`,
  matches Insights/Settings/Widget headers).
- Subtitle (muted, `text-sm text-muted-foreground`):
  - `{n} new since you last looked` when `totalUnseenCount > 0`
  - `You're all caught up` when `0`.
- Right: **Mark all as read** — `<Button variant="outline">` with a `CheckCheck`
  icon + label. `disabled` when `totalUnseenCount === 0`. On success briefly
  swaps to a `Check` + "Done" for ~2s (keeps the current confirmation pattern,
  now labeled and discoverable). Uses existing `useSetAllActivitiesSeen`.

### 2. Toolbar (`toolbar.tsx`) — one consolidated control, replaces the stat-card grid + old list-header

- **Category segmented control** (`category-filter.tsx`): a single-select
  `ToggleGroup type="single" variant="outline"` with items
  `All · Ideas · Issues · General · Comments`. Each item shows its **total
  count** (from `metaData`) and a small primary-colored **dot** when that
  category has unseen items (`unseen*Count > 0`). Single-select replaces the
  current four independent toggles — simpler mental model, less state. Default
  `All`. Horizontally scrollable on narrow screens (`overflow-x-auto`).
- **Unseen only** toggle (left of the controls row): a `Toggle` (`aria-pressed`)
  that filters the feed to unseen items. The single most important triage
  affordance.
- **Sort + status**: reuse the existing
  `components/ui/sorting-filtering-dropdown.tsx` (Newest / Most upvoted / Most
  commented + status). Status is a post concept, so **the Comments segment is
  disabled while a status filter is active** (and selecting Comments clears any
  status) — this prevents the contradictory state the current query already
  resolves by dropping comments.
- **Search**: always-visible input with an inset `Search` icon and a clear `X`,
  matching `insights/filter-bar.tsx` (replaces the hidden expanding overlay that
  covered the sort control). Debounced 500ms, min 2 chars (current behavior).
  On mobile it can sit on its own row.

### 3. List (`list.tsx`)

- Bordered card container `border-border bg-background rounded-lg border shadow-xs`
  wrapping the rows (toolbar now lives **above** the card, like Insights).
- Data via `useActivityFeed` → `useInfiniteQuery` (see Data flow). Flattens
  `data.pages[].items`.
- Infinite scroll via `react-intersection-observer` `useInView` sentinel +
  `Spinner` "Loading more…" footer (identical pattern to `feedback-posts`).
- States: `<ActivityFeedLoading>` (skeleton) while pending; `<Error>` on error;
  `<ActivityFeedEmpty variant>` for the four empty cases.

### 4. Row (`list-item.tsx`) — "comfortable, category-led"

Layout: a leading **category icon** in a subtle rounded container, a flexible
main column, and a trailing action area.

- **Leading**: category icon — `idea→Lightbulb`, `issue→BadgeAlert`,
  `general feedback→NotebookText`, `comment→MessageSquare` (current mapping) in
  a `size-8` `rounded-md border` box (`text-muted-foreground`).
- **Main column** (wrapped in the existing `<Link href={platformUrl}/{postId}>`
  that marks the item seen on click):
  - **Meta top** (`text-xs text-muted-foreground`):
    `{Idea | Issue | General feedback | Comment · "{parent title}"}` then a `·`
    then the colored **status** (only for posts with a status, using
    `text-{status}` semantic colors). Comments read `Comment · "Add dark mode"`
    so the parent post is unambiguous (fixes the title-confusion bug).
  - **Title** (`text-sm`, `font-semibold` when unseen else `font-medium`,
    `group-hover:underline`). For comments the title line is omitted (the parent
    title already shows in meta); the comment leads with its snippet.
  - **Snippet**: `<TiptapOutput>` `line-clamp-2` (`line-clamp-1` on mobile),
    `text-muted-foreground`, `forbiddenTags={["a","pre","img"]}` (current).
  - **Author line** (`text-xs text-muted-foreground`, reuses the
    `comment/header.tsx` convention): `<Avatar className="size-5">` with
    `AvatarImage src={authorPhotoURL}` + initial fallback (`UserIcon` for
    anonymous API submissions where `authorId` is null → name "Anonymous"),
    then `{authorName}` · `{timeAgo "mini-now"}` · engagement
    `▲ {upvotes}` and, for posts, `💬 {commentCount}` (data already fetched,
    just newly displayed).
- **Trailing action area** (top-right):
  - The shared options menu (`FeedbackPostOptionsMenu` / `CommentsOptionsMenu`),
    always present.
  - For **unseen** rows only, a hover-revealed ghost **Mark as read** button
    (`Check` icon + tooltip) that calls `useSetActivitiesSeen([id])` without
    navigating — dismiss noise without opening it.
- **Unseen treatment**: a 2px left accent bar (blue —
  `border-l-blue-600` / `dark:border-l-blue-500`, the conventional "unread"
  signal, matching the unseen dots on the filter segments) + bold title +
  very subtle row tint (`bg-muted/30`). Replaces the inline blue dot with a
  scannable inbox-style accent. Seen rows are flat.

## File layout

| File | Change | Role |
|---|---|---|
| `components/app/activity-feed/index.tsx` | rewrite | Composition root: `<ActivityFeedHeader>` + `<ActivityFeedToolbar>` + `<ActivityFeedList>`. Reads `metaData` once, passes counts down. |
| `components/app/activity-feed/header.tsx` | new | Title + unseen subtitle + "Mark all as read". |
| `components/app/activity-feed/toolbar.tsx` | new | Hosts category filter + unseen toggle + sort/status + search. Reads/writes the atom. |
| `components/app/activity-feed/category-filter.tsx` | new | Segmented `ToggleGroup` with counts + unseen dots. |
| `components/app/activity-feed/list.tsx` | rewrite | Infinite-query list; flatten/states/sentinel. |
| `components/app/activity-feed/list-items.tsx` | keep | Trivial map → rows (unchanged). |
| `components/app/activity-feed/list-item.tsx` | rewrite | New comfortable category-led row. |
| `components/app/activity-feed/loading.tsx` | rewrite | Skeleton matching the new row (icon box + title + snippet + meta). |
| `components/app/activity-feed/empty.tsx` | new | `<Empty>`-based states: platform / search / filter / caught-up. |
| `components/app/activity-feed/search-input.tsx` | rewrite | Always-visible input (insights-style), debounced. |
| `components/app/activity-feed/list-header.tsx` | delete | Folded into `toolbar.tsx`. |
| `components/app/activity-feed/list-pagination.tsx` | delete | Replaced by infinite scroll. |
| `lib/atoms.ts` | edit | New `activtyFeedStateAtom` shape (below). |
| `hooks/use-activity-feed.ts` | edit | `useQuery` → `useInfiniteQuery` (page param); add `unseenOnly`. |
| `queries/get-activity-feed.ts` | edit | Hide status-comments; add `unseenOnly` filter; select `authorPhotoURL`. |
| `queries/get-activity-feed-meta-data.ts` | edit | Hide status-comments from comment counts. |
| `trpc/get-activity-feed.ts` | edit | Swap `page` input → numeric `cursor` (page no.); add `unseenOnly`; return `nextCursor`. |
| `lib/typings.ts` | edit | Add `authorPhotoURL?: string \| null` to `ActivityFeedItem`. |

Each file stays small and single-purpose (target < 150 lines) so it can be held
in context and changed in isolation.

## State & data flow

### Atom (`activtyFeedStateAtom`)

Replaces the four category booleans + `page` with a single category value and
adds `unseenOnly`:

```ts
atomWithReset<{
  searchValue: string;
  orderBy: FeedbackOrderBy;          // "newest" | "upvotes" | "comments"
  status: FeedbackStatus;            // null | "under consideration" | ...
  category: "all" | "idea" | "issue" | "general feedback" | "comments";
  unseenOnly: boolean;
}>({
  searchValue: "", orderBy: "newest", status: null,
  category: "all", unseenOnly: false,
})
```

`page` is removed (infinite query owns pagination). `GlobalOrgState` still
`RESET`s this atom when navigating away from `/activity` (unchanged logic).

### Mapping category → existing query params

The server query keeps its current `categories` / `excludeFeedback` /
`excludeComments` parameters; the toolbar derives them from `category`:

| `category` | `categories` | `excludeComments` | `excludeFeedback` |
|---|---|---|---|
| `all` | `null` | `false` | `false` |
| `idea` | `["idea"]` | `true` | `false` |
| `issue` | `["issue"]` | `true` | `false` |
| `general feedback` | `["general feedback"]` | `true` | `false` |
| `comments` | `null` | `false` | `true` |

### Infinite query (tRPC `cursor` = page number)

To match the repo's infinite-query convention (`getFeedbackPosts` uses a
`cursor` input + a `nextCursor` return), the procedure swaps its `page` input
for a numeric `cursor` (the page number) and returns `nextCursor`. The
underlying **offset query is kept as-is** — the union + semantic-search query
isn't amenable to a cheap keyset cursor, and offset paging is already correct —
so the tRPC layer just maps `page = cursor ?? 1` and computes
`nextCursor = currentPage < totalPages ? currentPage + 1 : undefined`.

`use-activity-feed.ts` → `useInfiniteQuery`:

```ts
trpc.getActivityFeed.infiniteQueryOptions(
  { pageSize: 20, orderBy, status, categories, excludeFeedback,
    excludeComments, searchValue, unseenOnly },
  { enabled, getNextPageParam: (last) => last.nextCursor },
)
```

tRPC injects the page number as `cursor`; the component flattens
`data.pages.flatMap(p => p.items)`.

### Query changes (`get-activity-feed.ts`)

1. **Hide status-comments** — uncomment/add in both the `commentCount`
   subquery and the `commentsCTE`:
   `.where("comment.content", "not like", "Updated status to%")`.
2. **`unseenOnly`** — after the `activity_seen` left join, when `unseenOnly`:
   `.where("activity_seen.userId", "is", null)`.
3. **Avatar** — add `"user.photoURL as authorPhotoURL"` to both CTEs.
4. Query function (`getActivityFeedQuery`) keeps its `page`/`pageSize`/offset
   signature and `items/totalItemsCount/totalPages/currentPage` return; the
   `cursor → page` mapping and `nextCursor` live at the tRPC boundary (above).

### Meta-data changes (`get-activity-feed-meta-data.ts`)

Add the same `not like 'Updated status to%'` filter to the `commentsCTE` so
`totalCommentCount` / `unseenCommentCount` (and thus the Comments segment count
and dot) exclude status-change noise. Per-category post counts are unaffected.

### Mark-as-seen

- **Click-through** (open item): `useSetActivitiesSeen([id])` — unchanged.
- **Row "Mark as read"** (hover, unseen only): same hook, no navigation — new.
- **Mark all as read**: `useSetAllActivitiesSeen` — unchanged.
- All three already invalidate/refetch `getActivityFeed` + `getActivityFeedMetaData`.

## Empty / error / loading states

- **Loading** (`loading.tsx`): skeleton rows mirroring the new layout — a
  `size-8` icon-box skeleton + title line + two snippet lines + a short meta
  line — inside the bordered card.
- **Error**: shared `<Error title="Could not load activity" description=… />`.
- **Empty** (`empty.tsx`, shared `<Empty>` primitive):
  - *Platform empty* (no activity at all): `Inbox` icon, "No activity yet",
    "Feedback and comments from your users will appear here."
  - *Caught-up* (`unseenOnly` on, none unseen): `CheckCheck` icon, "You're all
    caught up", with a "Show all activity" action that turns the toggle off.
  - *Search empty*: "No matches for your search", "Clear search" action.
  - *Filter empty* (category/status yields nothing): "No {category} found",
    reset action.

## Visual conventions reused

- Heading: `<h2 className="h5">`. Subtitle: `text-sm text-muted-foreground`.
- List card: `border-border bg-background rounded-lg border shadow-xs`.
- Status colors: semantic `text-{status}` (`under-consideration` purple,
  `planned` orange, `in-progress` blue, `done` green, `declined` red) — already
  in `globals.css`.
- Author block: `Avatar` + `AvatarImage`/`AvatarFallback` + `timeAgo` "mini-now"
  exactly as `comment/header.tsx`.
- Rich text: `<TiptapOutput>` with the current `forbiddenTags`.
- Sort/status: existing `sorting-filtering-dropdown.tsx`.
- Search/clear, Spinner footer, `useInView`: mirror `insights/filter-bar.tsx`
  and `feedback-posts/index.tsx`.
- Primitives: `ToggleGroup`, `Toggle`, `Button`, `Tooltip`, `Badge`, `Empty`,
  `Error`, `Skeleton` — all already in `components/ui/*`.

## Accessibility

- Category control: `ToggleGroup` (Radix radiogroup semantics); each item has an
  accessible name including its count (e.g., "Ideas, 4 items, has new"). The
  unseen dot is decorative; "has new" is conveyed in the accessible name.
- Unseen toggle: `aria-pressed`; clear label "Unseen only".
- Status is never color-only — the text label is always present alongside color.
- Rows: the `<Link>` accessible name is the title (or, for comments, the parent
  title); "Mark as read" and `⋯` have explicit `aria-label`s + tooltips.
- Infinite scroll: a visually-hidden `aria-live="polite"` "Loading more activity"
  announcement when the next page fetches.
- Keyboard: all controls reachable with visible focus rings (project defaults).

## Responsiveness

- Header: title/subtitle stack; the button stays right (label may hide below
  `xs`, icon remains).
- Toolbar: category segmented control scrolls horizontally on narrow screens;
  unseen toggle + sort + search wrap to their own row(s) on mobile.
- Rows: snippet `line-clamp-1` on mobile / `line-clamp-2` on `sm+`; the meta
  line wraps; engagement stays on the meta line.
- List card scrolls with the page; no nested scroll region.

## Theme support

Inherited via tokens + `next-themes`; status colors and accent already have
light/dark values in `globals.css`. No new theme wiring.

## Robustness checklist

- [x] No schema changes; reuses the existing offset query (lowest-risk paging).
- [x] Status-comment filter applied in **both** feed and meta-data queries, and
      in the per-post `commentCount`, so counts and feed agree.
- [x] `unseenOnly` is a pure additive `WHERE`; default `false` preserves today's
      results.
- [x] Single-select category maps onto existing params (no new server filter
      semantics) — table above is the single source of truth.
- [x] Anonymous (`authorId: null`) authors render a graceful fallback avatar +
      "Anonymous".
- [x] `category` mapping makes the contradictory "Comments + status" state
      unreachable (segment disabled while status active).
- [x] Files small + single-purpose; deletions (`list-header`, `list-pagination`)
      remove dead surface rather than leaving it.
- [x] No new dependencies.

## Out of scope (explicit YAGNI)

- Realtime updates, date-bucket grouping, mark-as-unread, multi-select category,
  batch actions, author-role badges in the feed, cursor-based pagination,
  per-author or per-status saved views.

## Open questions

None at design-approval time. Implementation can proceed on approval.
