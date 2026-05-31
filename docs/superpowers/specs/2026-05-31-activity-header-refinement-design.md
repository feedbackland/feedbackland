# Activity Header — Compact Inbox Toolbar (Refinement)

**Date:** 2026-05-31
**Status:** Implemented (plan `2026-05-31-activity-header-refinement.md`)
**Author:** Claude (with David)
**Builds on:** `2026-05-30-admin-activity-page-overhaul-design.md` (the broader page
overhaul, now implemented). This refines only the **header region** that overhaul
produced.

## Goal

Refine the Activity page header — the top region of the admin's triage inbox — into
a tighter, higher-clarity layout that **leads with the #1 triage need ("what's
new")** and follows shadcn best practices. Collapse today's three stacked control
rows to **two**, remove the arbitrary control grouping (the dead gap between
"Unseen only" on the far left and sort/search on the far right), and consolidate the
unread signal into a single, action-oriented count.

This is a focused, low-risk refinement: **UI-only**, no data/query/state changes, no
new dependencies.

## Scope

In scope (the header region):

- `components/app/activity-feed/header.tsx` — title + "Mark all as read".
- `components/app/activity-feed/toolbar.tsx` — the controls row(s).
- `components/app/activity-feed/category-filter.tsx` — the category control.
- `components/app/activity-feed/search-input.tsx` — minor (width handled by parent).

Out of scope (unchanged): the feed list and rows (`list*.tsx`, `list-item.tsx`),
empty/loading/error states, and the entire data layer — `lib/atoms.ts`, the hooks,
`queries/*`, `trpc/*`, `lib/typings.ts`. **No schema or query changes. No new deps.**

## Problems being fixed

1. **Three control rows** push content down on a page whose job is triage density.
2. **Arbitrary grouping**: "Unseen only" is pinned far-left while sort + search are
   pinned far-right, leaving a dead gap in the middle.
3. **The #1 affordance is buried**: filtering to unseen sits on the lowest row, far
   from "Mark all as read" at the top.
4. **No at-a-glance "how much is new"**: the total unseen count was dropped when the
   header was slimmed.
5. **Split unread signal**: a gray dot that turns blue + per-segment badges, with no
   single clear count.

## Chosen direction

**"Compact inbox toolbar."** Two rows total. Categories collapse into a dropdown to
buy horizontal density; the **unseen filter becomes the hero**, carrying the total
unseen count and leading the toolbar. (Selected over "refine the segmented bar" and
"filled Tabs" alternatives; the trade-off — categories are no longer one-tap visible —
was accepted in favor of density, with per-category counts preserved inside the
dropdown.)

## Layout

```
Activity                                          [ ✓✓ Mark all as read ]   ← row 1
[ ● Unseen 5 ]  [ 🔍 Search activity…………… ]  [ ⛉ All types ▾ ]  [ ↕ Newest ▾ ]  ← row 2
```

### Row 1 — identity + bulk action (`header.tsx`, ≈ unchanged)

- **Left:** `Activity` — `<h2 className="h5">`.
- **Right:** `Mark all as read` — `Button variant="outline"` with a `CheckCheck`
  icon + label; `disabled` when `totalUnseenCount === 0`; on success swaps to a
  `Check` + "Done" for ~2.5s. Uses the existing `useSetAllActivitiesSeen`.
  **(Existing behavior, kept as-is.)**
- **No title count pill** — the count lives on the Unseen chip instead (see below).

### Row 2 — inbox toolbar (`toolbar.tsx`, rewrite)

A single flex row. **Control order (locked): A — `Unseen · Search · Type · Sort`.**

1. **Unseen** — the hero filter, leftmost (triage-first). A `Toggle` driving
   `unseenOnly`. Label `Unseen` + a blue count `Badge` = `totalUnseenCount` (shown
   only when `> 0`). States:
   - **Off, unseen > 0:** outline, muted label, blue count badge — inviting.
   - **On:** blue-tinted (`data-[state=on]` → blue border + `bg-accent`/blue tint,
     blue label), badge retained.
   - **Caught up (0):** no badge, slightly subdued; **stays enabled** (toggling on
     with nothing unseen surfaces the existing "you're all caught up" empty state).
   - Replaces the old "Unseen only" toggle and its gray→blue dot.
2. **Search** — `flex-1` (grows to fill, killing the dead gap). The existing
   always-visible `InputGroup` (`search-input.tsx`): inset `SearchIcon` + clear `X`,
   debounced 500ms, min 2 chars, placeholder "Search activity…". Width comes from the
   parent (`flex-1`); the component itself is unchanged apart from that.
3. **Category** — a **dropdown** (`category-filter.tsx`, internals rewritten).
   `Button variant="outline"` with a leading tag icon + label + `ChevronDown`. The
   label reflects the current category: **"All types" · "Ideas" · "Issues" ·
   "General" · "Comments"**. Opens a `DropdownMenuRadioGroup` of the five options;
   each option shows a small blue **"N new"** badge when its unseen count `> 0`
   (so "where's the new stuff" survives the collapse). **"Comments" is disabled while
   a status filter is active** (existing conflict rule), and selecting a status while
   "Comments" is active falls back to "all" (existing logic, preserved).
4. **Sort / status** — the existing
   `components/ui/sorting-filtering-dropdown.tsx` with `variant="outline"`
   (Newest / Most upvoted / Most commented + status). **Unchanged.**

### Mobile (`< sm`)

- **Row 1:** title + "Mark all as read" (label may hide below a small breakpoint;
  the icon remains).
- **Row 2:** `[ Unseen ] [ All types ▾ (grows) ] [ Sort ▾ ]`.
- **Row 3:** Search, full-width.

## Unread-signal system (consolidated)

- **Total unseen → the count badge on the Unseen chip** (the single source of the
  number, on the control that acts on it).
- **Per-category unseen → "N new" badges inside the category dropdown.**
- **Row accent bars on unseen items** → already implemented in `list-item.tsx`,
  unchanged.
- **One color: blue**, matching the existing unseen accent.
- **No title count pill** (removes the redundancy the earlier mockups had).

## Components

| File | Change | Role after |
|---|---|---|
| `header.tsx` | keep (≈ no change) | `Activity` title + "Mark all as read". |
| `toolbar.tsx` | **rewrite** | Single-row inbox toolbar: Unseen chip + search + category dropdown + sort. Still reads/writes `activtyFeedStateAtom`; same handlers (`handleCategory`, `handleUnseen`, `handleSearch`, `handleSortingFiltering`). |
| `category-filter.tsx` | **rewrite internals** | `ActivityCategoryFilter` renders a `DropdownMenu` (was a `ToggleGroup`). **Same props** — `value`, `unseenCounts`, `commentsDisabled`, `onChange` — so `index.tsx`/`toolbar.tsx` wiring is unaffected. |
| `search-input.tsx` | keep (minor) | Already always-visible; parent applies `flex-1`. |

No change: `index.tsx` (composition + count plumbing unchanged), `list*.tsx`,
`empty.tsx`, `loading.tsx`, `lib/atoms.ts`, hooks, `queries/*`, `trpc/*`,
`lib/typings.ts`.

## State & data (unchanged)

- `activtyFeedStateAtom` already holds `{ searchValue, orderBy, status, category,
  unseenOnly }` — every control maps onto an existing field.
- Category → query-param mapping is unchanged (the table in the 2026-05-30 spec
  remains the source of truth).
- `getActivityFeedMetaData` already returns `totalUnseenCount` and the per-category
  unseen counts (`unseenIdeasPostCount`, `unseenIssuesPostCount`,
  `unseenGeneralFeedbackPostCount`, `unseenCommentCount`) — exactly what the chip
  badge and the dropdown badges render. **No total (seen+unseen) counts exist, and
  none are needed.**

## Accessibility

- **Unseen** `Toggle`: `aria-pressed`; accessible name "Show unseen only" with the
  count included; the dot/badge is decorative.
- **Category** dropdown: trigger `aria-haspopup="menu"`; `DropdownMenuRadioGroup`
  semantics; the disabled "Comments" item keeps an accessible reason.
- **Sort**: existing semantics.
- **Search**: existing `aria-label`s; `Escape` clears (existing).
- All controls keyboard-reachable with visible focus rings (project defaults).

## Visual conventions reused

`h5` title; outline `Button` (`h-9`, `shadow-xs`); outline `Toggle`; the
`DropdownMenu` radio pattern (mirrors `SortingFilteringDropdown` for visual rhythm
between the two adjacent dropdowns); `InputGroup` search; blue unseen accent; `Badge`
for counts. No new primitives, no new dependencies.

## Decisions locked

- Direction 3 (compact inbox toolbar); control order **A** (`Unseen · Search · Type
  · Sort`).
- **No** title count pill — the count lives on the Unseen chip.
- Category trigger label "All types"; per-category unseen badges shown in-menu.

## Out of scope / YAGNI

Feed rows and list states; realtime; date-bucket grouping; mark-as-unread; total
per-category counts; multi-select category; saved views; any data-layer change.

## Open questions

None at approval. Control order **A** is assumed from design sign-off; swapping to
**B** (`Unseen · Type · Sort · Search`) is a one-line reorder if preferred.
