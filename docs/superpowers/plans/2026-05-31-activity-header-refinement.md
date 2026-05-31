# Activity Header — Compact Inbox Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the Activity page header into a two-row "compact inbox toolbar" — an `Unseen`-led single control row (Unseen chip · Search · Category dropdown · Sort) under the title + "Mark all as read".

**Architecture:** UI-only refactor of three files. Replace the segmented category `ToggleGroup` with a `DropdownMenu` (same props), collapse the two-row toolbar into one responsive flex-wrap row that reorders across the `sm` breakpoint via Tailwind `order-*` utilities, and turn the "Unseen only" toggle into the hero filter carrying the total unseen count. No data, query, atom, or dependency changes.

**Tech Stack:** Next.js (App Router) + React client components, Tailwind v4 (`cn` = clsx + tailwind-merge), shadcn/ui (Radix), jotai, lucide-react.

**Verification note:** This repo has **no test runner** and `npm run lint` is broken (Next 16). Per project convention, each task is verified with `npx tsc --noEmit` (type-check) and the feature is verified visually in the running app; a final `npm run build` gates completion. There are no unit-test steps because there is no framework to run them.

**Spec:** `docs/superpowers/specs/2026-05-31-activity-header-refinement-design.md`

---

## File structure

| File | Change | Responsibility after |
|---|---|---|
| `components/app/activity-feed/category-filter.tsx` | rewrite internals | `ActivityCategoryFilter` renders a `DropdownMenu` (was `ToggleGroup`); same props plus optional `className` for the trigger. |
| `components/ui/sorting-filtering-dropdown.tsx` | additive | Accept optional `className`, forward to the outline trigger `Button`. |
| `components/app/activity-feed/toolbar.tsx` | rewrite | Single responsive flex-wrap row: Unseen `Toggle` (with count) · Search (`flex-1`) · category dropdown · sort dropdown. |

Unchanged: `header.tsx`, `search-input.tsx`, `index.tsx`, `list*.tsx`, `empty.tsx`, `loading.tsx`, `lib/atoms.ts`, hooks, `queries/*`, `trpc/*`, `lib/typings.ts`.

---

## Task 1: Category control → dropdown

**Files:**
- Modify (full rewrite): `components/app/activity-feed/category-filter.tsx`

- [ ] **Step 1: Rewrite `category-filter.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityCategory =
  | "all"
  | "idea"
  | "issue"
  | "general feedback"
  | "comments";

const SEGMENTS: {
  value: ActivityCategory;
  trigger: string;
  item: string;
}[] = [
  { value: "all", trigger: "All types", item: "All activity" },
  { value: "idea", trigger: "Ideas", item: "Ideas" },
  { value: "issue", trigger: "Issues", item: "Issues" },
  { value: "general feedback", trigger: "General", item: "General" },
  { value: "comments", trigger: "Comments", item: "Comments" },
];

export function ActivityCategoryFilter({
  value,
  unseenCounts,
  commentsDisabled,
  onChange,
  className,
}: {
  value: ActivityCategory;
  unseenCounts: Record<ActivityCategory, number>;
  commentsDisabled: boolean;
  onChange: (value: ActivityCategory) => void;
  className?: string;
}) {
  const active = SEGMENTS.find((s) => s.value === value) ?? SEGMENTS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("gap-1.5", className)}>
          <Tag className="size-3.5!" />
          <span className="truncate">{active.trigger}</span>
          <ChevronDown className="text-muted-foreground size-3.5!" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as ActivityCategory)}
        >
          {SEGMENTS.map((seg) => {
            const count = unseenCounts[seg.value] ?? 0;
            const disabled = seg.value === "comments" && commentsDisabled;
            return (
              <DropdownMenuRadioItem
                key={seg.value}
                value={seg.value}
                disabled={disabled}
                aria-label={`${seg.item}${count > 0 ? `, ${count} new` : ""}`}
              >
                <span>{seg.item}</span>
                {count > 0 && (
                  <span className="ml-auto inline-flex h-5 items-center rounded-full border border-blue-100 bg-blue-50 px-1.5 text-[10px] font-medium tabular-nums text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                    {count} new
                  </span>
                )}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). The component's exported name, type, and props are unchanged except the new optional `className`, so `toolbar.tsx`'s existing usage still type-checks.

- [ ] **Step 3: Commit**

```bash
git add components/app/activity-feed/category-filter.tsx
git commit -m "refactor(activity): category filter as a dropdown with unseen badges"
```

---

## Task 2: Optional `className` on the sort dropdown

**Files:**
- Modify: `components/ui/sorting-filtering-dropdown.tsx`

- [ ] **Step 1: Add the prop**

Change the function signature to accept `className` and forward it to the outline trigger `Button`.

Signature (replace the existing one):

```tsx
export function SortingFilteringDropdown({
  orderBy,
  status,
  onChange,
  variant = "link",
  className,
}: {
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  onChange: ({
    orderBy,
    status,
  }: {
    orderBy: FeedbackOrderBy;
    status: FeedbackStatus;
  }) => void;
  variant?: "link" | "outline";
  className?: string;
}) {
```

Outline trigger (replace the existing outline `Button` opening tag):

```tsx
          <Button variant="outline" className={cn("gap-1.5", className)}>
```

`cn` is already imported in this file; the `"link"` branch is unchanged.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. `className` is optional, so the existing `feedback-posts/index.tsx` call (no `className`) is unaffected.

- [ ] **Step 3: Commit**

```bash
git add components/ui/sorting-filtering-dropdown.tsx
git commit -m "feat(ui): allow className on SortingFilteringDropdown outline trigger"
```

---

## Task 3: Toolbar → single compact inbox row

**Files:**
- Modify (full rewrite): `components/app/activity-feed/toolbar.tsx`

Responsive behavior via `order-*`: DOM order is Unseen → Search → Category → Sort. On mobile, Search is `order-last` + `w-full` (its own line) and Category is `order-2` (grows to fill row 1 beside Unseen/Sort). At `sm+`, Search is `order-2` + `flex-1` (grows mid-row) and Category/Sort fall to `order-3/4` at natural width.

- [ ] **Step 1: Rewrite `toolbar.tsx`**

```tsx
"use client";

import { useAtom } from "jotai";
import { activtyFeedStateAtom } from "@/lib/atoms";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { ActivityCategory, ActivityCategoryFilter } from "./category-filter";
import { ActivityFeedSearchInput } from "./search-input";
import { SortingFilteringDropdown } from "@/components/ui/sorting-filtering-dropdown";
import { Toggle } from "@/components/ui/toggle";

export function ActivityFeedToolbar({
  unseenCounts,
}: {
  unseenCounts: Record<ActivityCategory, number>;
}) {
  const [state, setState] = useAtom(activtyFeedStateAtom);
  const { category, orderBy, status, unseenOnly } = state;

  const totalUnseen = unseenCounts.all ?? 0;

  const handleCategory = (next: ActivityCategory) =>
    setState((prev) => ({ ...prev, category: next }));

  const handleUnseen = (pressed: boolean) =>
    setState((prev) => ({ ...prev, unseenOnly: pressed }));

  const handleSearch = (searchValue: string) =>
    setState((prev) => ({ ...prev, searchValue }));

  const handleSortingFiltering = ({
    orderBy,
    status,
  }: {
    orderBy: FeedbackOrderBy;
    status: FeedbackStatus;
  }) =>
    setState((prev) => ({
      ...prev,
      orderBy,
      status,
      // status is a post concept; leaving "comments" selected while a status
      // is active would be contradictory, so fall back to "all".
      category: status && prev.category === "comments" ? "all" : prev.category,
    }));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Toggle
        variant="outline"
        size="default"
        pressed={unseenOnly}
        onPressedChange={handleUnseen}
        aria-label="Show unseen only"
        aria-pressed={unseenOnly}
        className="order-1 gap-2 px-3 data-[state=on]:border-blue-200 data-[state=on]:bg-blue-50 data-[state=on]:text-blue-700 dark:data-[state=on]:border-blue-900 dark:data-[state=on]:bg-blue-950 dark:data-[state=on]:text-blue-300"
      >
        Unseen
        {totalUnseen > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium tabular-nums text-white dark:bg-blue-500">
            {totalUnseen}
          </span>
        )}
      </Toggle>

      <ActivityFeedSearchInput
        onDebouncedChange={handleSearch}
        className="order-last min-w-0 sm:order-2 sm:w-auto sm:flex-1"
      />

      <ActivityCategoryFilter
        value={category}
        unseenCounts={unseenCounts}
        commentsDisabled={status !== null}
        onChange={handleCategory}
        className="order-2 flex-1 sm:order-3 sm:flex-none"
      />

      <SortingFilteringDropdown
        orderBy={orderBy}
        status={status}
        onChange={handleSortingFiltering}
        variant="outline"
        className="order-3 sm:order-4"
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/app/activity-feed/toolbar.tsx
git commit -m "refactor(activity): compact single-row inbox toolbar"
```

---

## Task 4: Verify in the running app

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds with no type or compile errors.

- [ ] **Step 2: Visual check (dev server)**

Run the app, open the admin Activity page, and confirm:
- Two rows: `Activity` + `Mark all as read` on top; one toolbar row below.
- Toolbar order on desktop: `Unseen [N]` · Search (fills width) · `All types ▾` · `Newest ▾`.
- Unseen toggle: off shows blue count badge when unseen > 0; on shows blue tint; toggling filters the feed.
- Category dropdown opens with the five options; categories with unseen show an "N new" badge; selecting one updates the trigger label and the feed; "Comments" is disabled while a status filter is active.
- Search filters (debounced) and clears with the X / Escape.
- Narrow the window: search drops to its own full-width line; `Unseen · Category · Sort` stay on the row above.
- Dark mode: blue tints and badges read correctly.

- [ ] **Step 2b: Screenshot for the record** (optional, if a browser-driver/`run` skill is available) — capture the new header light + dark.

- [ ] **Step 3: No commit** (verification only). If a defect is found, fix in the relevant task's file and re-run Steps 1–2.

---

## Self-review

**Spec coverage:**
- Two-row layout, order A → Task 3. ✓
- Unseen hero with total count + states (off/on/0) → Task 3 (badge gated on `totalUnseen > 0`; blue on-state). ✓
- No title pill → Task 3 (toolbar owns the count; `header.tsx` untouched). ✓
- Category dropdown with per-category unseen badges + "Comments disabled while status active" + status↔comments fallback → Tasks 1 & 3. ✓
- Search `flex-1`, always-visible, existing debounce → Task 3 (className only; `search-input.tsx` unchanged). ✓
- Sort unchanged but positioned → Task 2 (optional className) + Task 3. ✓
- Mobile stacking → Task 3 (`order-*` + `w-full`/`flex-1`). ✓
- Accessibility (aria-pressed, accessible item names, disabled reason) → Tasks 1 & 3. ✓
- No data/dep changes → confirmed; only the three files above change.

**Placeholder scan:** none — every step has full code or an exact command + expected result.

**Type consistency:** `ActivityCategory` and `ActivityCategoryFilter` props (`value`, `unseenCounts`, `commentsDisabled`, `onChange`, `className?`) are consistent between Task 1 and their use in Task 3; `unseenCounts.all` supplies `totalUnseen`; `SortingFilteringDropdown`'s new `className?` matches its Task 3 usage.
