# Admin Activity Page Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin Activity page into a dense, consistent triage inbox — one consolidated filter bar (replacing four stat cards + a dropdown + a hidden search), an "Unseen only" filter, infinite scroll, richer category-led rows (author avatar + upvotes + comments), proper Empty/Error states, and the "Updated status to…" noise removed from the feed and counts.

**Architecture:** Frontend rebuild of `components/app/activity-feed/*` plus three minor, backward-compatible server tweaks. The existing offset query is kept; the tRPC boundary swaps its `page` input for a numeric `cursor` (page number) + `nextCursor` return so the client can use `useInfiniteQuery` exactly like `getFeedbackPosts`. A single-select category drives the existing `categories`/`excludeFeedback`/`excludeComments` params. No DB schema changes. See spec: `docs/superpowers/specs/2026-05-30-admin-activity-page-overhaul-design.md`.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, tRPC 11 + `@trpc/tanstack-react-query`, TanStack Query 5, Kysely + pgvector, Jotai, Tailwind v4, shadcn/ui, lucide-react, `react-use`, `react-intersection-observer`.

**File summary:**
- **Edit:** `lib/typings.ts` (add `authorPhotoURL`), `queries/get-activity-feed.ts` (hide status-comments, `unseenOnly`, avatar), `queries/get-activity-feed-meta-data.ts` (hide status-comments), `trpc/get-activity-feed.ts` (`cursor`+`unseenOnly`+`nextCursor`), `hooks/use-activity-feed.ts` (infinite query), `lib/atoms.ts` (atom reshape)
- **Rewrite:** `components/app/activity-feed/{index,list,list-item,loading,search-input}.tsx`
- **Create:** `components/app/activity-feed/{header,toolbar,category-filter,empty}.tsx`
- **Delete:** `components/app/activity-feed/{list-header,list-pagination}.tsx`
- **Unchanged:** `components/app/activity-feed/list-items.tsx`, `hooks/use-activity-feed-meta-data.ts`, `hooks/use-set-activities-seen.ts`, `hooks/use-set-all-activities-seen.ts`, `components/app/global-org-state/index.tsx` (only calls `RESET`)

**Conventions used in this plan:**
- All paths are relative to repo root: `C:\Users\David\Downloads\feedbackland`.
- Work happens on the existing branch `activity-page-overhaul` (already created; the spec is committed there).
- **Verification is repo-native: this project has no unit-test framework.** Use `npx tsc --noEmit` (typecheck), `npm run lint` (eslint via `next lint`), `npm run build` (full gate), and a manual `npm run dev` walkthrough. "Expected: clean" means no *new* errors referencing the files you changed.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Phases 1 and 2 keep the app building and runnable on every commit. Phase 3 is one cohesive "flip" (shared atom + hook + tRPC shape change together) committed once at the end — intermediate edits within Phase 3 will not typecheck until the phase completes; that is expected and stays on the branch.

---

## Phase 1 — Server / data layer (backward-compatible)

### Task 1: Hide status-comments, add `unseenOnly`, and select the author avatar in the activity query

**Files:**
- Modify: `lib/typings.ts`
- Modify: `queries/get-activity-feed.ts`

- [ ] **Step 1: Add `authorPhotoURL` to the `ActivityFeedItem` type**

In `lib/typings.ts`, change the `ActivityFeedItem` type — add the `authorPhotoURL` line:

```ts
export type ActivityFeedItem = {
  orgId: string;
  id: string;
  postId: string;
  commentId: string | null;
  createdAt: Date;
  title: string | null;
  content: string;
  upvotes: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  type: string;
  commentCount: string | null;
  authorId: string | null;
  authorName?: string | null;
  authorPhotoURL?: string | null;
  isSeen?: boolean;
};
```

- [ ] **Step 2: Replace the query file with the updated version**

Replace the entire contents of `queries/get-activity-feed.ts` with:

```ts
"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import { cosineDistance } from "pgvector/kysely";
import {
  ActivityFeedItem,
  FeedbackCategories,
  FeedbackCategory,
  FeedbackOrderBy,
  FeedbackStatus,
} from "@/lib/typings";
import { generateQueryVector } from "@/lib/utils-server";

export async function getActivityFeedQuery({
  orgId,
  userId,
  page,
  pageSize,
  orderBy,
  status,
  categories,
  excludeFeedback,
  excludeComments,
  searchValue,
  unseenOnly,
}: {
  orgId: string;
  userId: string;
  page: number;
  pageSize: number;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  categories: FeedbackCategories;
  excludeFeedback: boolean;
  excludeComments: boolean;
  searchValue: string;
  unseenOnly: boolean;
}) {
  try {
    const offset = (page - 1) * pageSize;
    const isSearching = searchValue.length > 0;
    const maxDistance = 0.4;
    let searchVector: number[] | null = null;

    if (isSearching) {
      searchVector = await generateQueryVector(searchValue);

      if (!searchVector) {
        return {
          items: [],
          totalItemsCount: 0,
          totalPages: 0,
          currentPage: page,
        };
      }
    }

    let feedbackQuery = db
      .selectFrom("feedback")
      .leftJoin("user", "feedback.authorId", "user.id")
      .where("feedback.orgId", "=", orgId);

    if (status) {
      feedbackQuery = feedbackQuery.where("feedback.status", "=", status);
    }

    if (categories && categories.length > 0) {
      feedbackQuery = feedbackQuery.where(
        "feedback.category",
        "in",
        categories,
      );
    }

    const feedbackCTE = feedbackQuery.select([
      "feedback.orgId",
      "feedback.id",
      "feedback.id as postId",
      sql<string | null>`null`.as("commentId"),
      "feedback.createdAt",
      "feedback.title",
      "feedback.description as content",
      "feedback.upvotes",
      "feedback.category",
      "feedback.status",
      sql<string>`'post'`.as("type"),
      (eb) =>
        eb
          .selectFrom("comment")
          .select(eb.fn.countAll<string>().as("commentCount"))
          .whereRef("comment.postId", "=", "feedback.id")
          .where("comment.content", "not like", "Updated status to%")
          .as("commentCount"),
      "user.id as authorId",
      "user.name as authorName",
      "user.photoURL as authorPhotoURL",
      ...(isSearching
        ? [cosineDistance("feedback.embedding", searchVector).as("distance")]
        : [sql<null>`null`.as("distance")]),
    ]);

    const commentsCTE = db
      .selectFrom("comment")
      .innerJoin("feedback", "comment.postId", "feedback.id")
      .leftJoin("user", "comment.authorId", "user.id")
      .where("feedback.orgId", "=", orgId)
      .where("comment.content", "not like", "Updated status to%")
      .select([
        "feedback.orgId",
        "comment.id",
        "comment.postId",
        "comment.id as commentId",
        "comment.createdAt",
        "feedback.title as title",
        "comment.content",
        "comment.upvotes",
        sql<FeedbackCategory | null>`null`.as("category"),
        sql<FeedbackStatus | null>`null`.as("status"),
        sql<string>`'comment'`.as("type"),
        sql<string>`'0'`.as("commentCount"),
        "user.id as authorId",
        "user.name as authorName",
        "user.photoURL as authorPhotoURL",
        ...(isSearching
          ? [cosineDistance("comment.embedding", searchVector).as("distance")]
          : [sql<null>`null`.as("distance")]),
      ]);

    let activityQuery = db.selectFrom(
      feedbackCTE.unionAll(commentsCTE).as("activity"),
    );

    if (status) {
      // status is a post-only concept ⇒ only feedback records
      activityQuery = db.selectFrom(feedbackCTE.as("activity"));
    }

    if (excludeFeedback) {
      activityQuery = db.selectFrom(commentsCTE.as("activity"));
    } else if (excludeComments) {
      activityQuery = db.selectFrom(feedbackCTE.as("activity"));
    }

    let orderedQuery = activityQuery.selectAll("activity");

    if (!isSearching) {
      if (orderBy === "newest") {
        orderedQuery = orderedQuery.orderBy("activity.createdAt", "desc");
      } else if (orderBy === "upvotes") {
        orderedQuery = orderedQuery.orderBy("activity.upvotes", "desc");
      } else if (orderBy === "comments") {
        orderedQuery = orderedQuery.orderBy("activity.commentCount", "desc");
      } else {
        orderedQuery = orderedQuery.orderBy("activity.createdAt", "desc");
      }
    }

    if (isSearching) {
      orderedQuery = orderedQuery
        .where("activity.distance", "<", maxDistance)
        .orderBy("activity.distance")
        .orderBy("activity.createdAt", "desc");
    }

    let joinedQuery = orderedQuery.leftJoin("activity_seen", (join) =>
      join
        .onRef("activity.id", "=", "activity_seen.itemId")
        .on("activity_seen.userId", "=", userId),
    );

    if (unseenOnly) {
      joinedQuery = joinedQuery.where("activity_seen.userId", "is", null);
    }

    const finalQuery = joinedQuery
      .selectAll()
      .select((eb) => [
        eb("activity_seen.userId", "is not", null).as("isSeen"),
        eb.fn.count("activity.id").over().as("totalItemsCount"),
      ])
      .limit(pageSize)
      .offset(offset);

    const results = await finalQuery.execute();

    const items = results;
    const totalItemsCount =
      results.length > 0 ? Number(results[0].totalItemsCount) : 0;
    const itemsWithoutTotalCount: ActivityFeedItem[] = items.map(
      ({ totalItemsCount, isSeen, ...rest }) => {
        return { ...rest, isSeen: Boolean(isSeen) };
      },
    );
    const totalPages = Math.ceil(totalItemsCount / pageSize);

    return {
      items: itemsWithoutTotalCount,
      totalItemsCount,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    throw error;
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no errors referencing `get-activity-feed.ts` or `typings.ts`). The old tRPC procedure still compiles — its call omits `unseenOnly`, so verify Step 4 instead of assuming.

> NOTE: the old `trpc/get-activity-feed.ts` calls `getActivityFeedQuery` WITHOUT `unseenOnly`, which is now a required param ⇒ this will surface a type error there. Fix it in this same task to keep the build green:

- [ ] **Step 4: Pass `unseenOnly: false` from the (still-`page`-based) tRPC procedure**

In `trpc/get-activity-feed.ts`, inside the `getActivityFeedQuery({ ... })` call, add `unseenOnly: false,` (temporary; Phase 3 replaces this whole file). The call becomes:

```ts
        const { items, totalItemsCount, totalPages, currentPage } =
          await getActivityFeedQuery({
            orgId,
            userId,
            page,
            pageSize,
            orderBy,
            status,
            categories,
            excludeFeedback,
            excludeComments,
            searchValue,
            unseenOnly: false,
          });
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: clean.
Run: `npm run lint`
Expected: no new errors in the changed files.

- [ ] **Step 6: Commit**

```bash
git add lib/typings.ts queries/get-activity-feed.ts trpc/get-activity-feed.ts
git commit -m "feat(activity): hide status-comments, add unseenOnly + author avatar to feed query

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Exclude status-comments from the meta-data counts

**Files:**
- Modify: `queries/get-activity-feed-meta-data.ts`

- [ ] **Step 1: Add the filter to the comments CTE**

In `queries/get-activity-feed-meta-data.ts`, find the `commentsCTE` and add one `.where(...)` line so status-change comments don't inflate `totalCommentCount` / `unseenCommentCount`. Change:

```ts
    const commentsCTE = db
      .selectFrom("comment")
      .innerJoin("feedback", "comment.postId", "feedback.id")
      .leftJoin("user", "comment.authorId", "user.id")
      .where("feedback.orgId", "=", orgId)
      .select([
```

to:

```ts
    const commentsCTE = db
      .selectFrom("comment")
      .innerJoin("feedback", "comment.postId", "feedback.id")
      .leftJoin("user", "comment.authorId", "user.id")
      .where("feedback.orgId", "=", orgId)
      .where("comment.content", "not like", "Updated status to%")
      .select([
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add queries/get-activity-feed-meta-data.ts
git commit -m "feat(activity): exclude status-comments from activity meta counts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 — New & rewritten leaf components (app stays on the old shell)

> These keep their public interfaces (`ActivityFeedSearchInput({ onDebouncedChange })`, `ActivityFeedListItem({ item })`, `ActivityFeedLoading()`) so the still-live old `list.tsx`/`list-header.tsx` keep compiling and the page keeps working. New files (`category-filter`, `header`, `empty`) are not imported yet.

### Task 3: Rewrite the search input to be always-visible (insights-style)

**Files:**
- Rewrite: `components/app/activity-feed/search-input.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `components/app/activity-feed/search-input.tsx` with:

```tsx
"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "react-use";

export const ActivityFeedSearchInput = ({
  onDebouncedChange,
  delay = 500,
  className,
}: {
  onDebouncedChange: (value: string) => void;
  delay?: number;
  className?: React.ComponentProps<"div">["className"];
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");

  useDebounce(
    () => {
      onDebouncedChange(inputValue.length >= 2 ? inputValue : "");
    },
    delay,
    [inputValue],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setInputValue("");
      inputRef.current?.blur();
    }
  };

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search activity..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="bg-background pr-8 pl-8 text-sm"
        aria-label="Search activity feed"
      />
      {inputValue.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear search"
          onClick={() => {
            setInputValue("");
            inputRef.current?.focus();
          }}
          className="text-muted-foreground hover:text-primary absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run lint` — Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/app/activity-feed/search-input.tsx
git commit -m "feat(activity): always-visible search input

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Create the segmented category filter

**Files:**
- Create: `components/app/activity-feed/category-filter.tsx`

- [ ] **Step 1: Create the file**

Create `components/app/activity-feed/category-filter.tsx` with:

```tsx
"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ActivityCategory =
  | "all"
  | "idea"
  | "issue"
  | "general feedback"
  | "comments";

const SEGMENTS: { value: ActivityCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "idea", label: "Ideas" },
  { value: "issue", label: "Issues" },
  { value: "general feedback", label: "General" },
  { value: "comments", label: "Comments" },
];

export function ActivityCategoryFilter({
  value,
  counts,
  unseen,
  commentsDisabled,
  onChange,
}: {
  value: ActivityCategory;
  counts: Record<ActivityCategory, number>;
  unseen: Record<ActivityCategory, boolean>;
  commentsDisabled: boolean;
  onChange: (value: ActivityCategory) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as ActivityCategory);
      }}
      className="w-full justify-start gap-1.5 overflow-x-auto"
    >
      {SEGMENTS.map((seg) => (
        <ToggleGroupItem
          key={seg.value}
          value={seg.value}
          disabled={seg.value === "comments" && commentsDisabled}
          aria-label={`${seg.label}, ${counts[seg.value]} items${
            unseen[seg.value] ? ", has new" : ""
          }`}
          className="data-[state=on]:border-primary data-[state=on]:bg-accent shrink-0 gap-1.5 whitespace-nowrap"
        >
          <span>{seg.label}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {counts[seg.value]}
          </span>
          {unseen[seg.value] && (
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-500"
            />
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run lint` — Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/app/activity-feed/category-filter.tsx
git commit -m "feat(activity): segmented category filter with counts + unseen dots

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Rewrite the row (comfortable, category-led)

**Files:**
- Rewrite: `components/app/activity-feed/list-item.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `components/app/activity-feed/list-item.tsx` with:

```tsx
"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";
import { CommentsOptionsMenu } from "../comment/options-menu";
import { useSetActivitiesSeen } from "@/hooks/use-set-activities-seen";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import {
  ArrowBigUp,
  BadgeAlert,
  Check,
  Lightbulb,
  MessageSquare,
  NotebookText,
  UserIcon,
} from "lucide-react";

function CategoryIcon({ item }: { item: ActivityFeedItem }) {
  const className = "size-4";
  if (item.type === "comment") return <MessageSquare className={className} />;
  if (item.category === "idea") return <Lightbulb className={className} />;
  if (item.category === "issue") return <BadgeAlert className={className} />;
  return <NotebookText className={className} />;
}

export function ActivityFeedListItem({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  const platformUrl = usePlatformUrl();
  const setActivitySeen = useSetActivitiesSeen();

  const {
    id,
    postId,
    type,
    category,
    status,
    title,
    content,
    createdAt,
    upvotes,
    commentCount,
    authorName,
    authorPhotoURL,
    isSeen,
  } = item;

  const isComment = type === "comment";
  const isUnseen = !isSeen;

  const markSeen = () => setActivitySeen?.mutate({ itemIds: [id] });

  return (
    <div
      className={cn(
        "group/item border-border relative flex items-start gap-3 border-b border-l-2 py-4 pr-2 pl-3 transition-colors",
        isUnseen ? "border-l-primary bg-muted/30" : "border-l-transparent",
        className,
      )}
    >
      <div className="text-muted-foreground border-border bg-background mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border">
        <CategoryIcon item={item} />
      </div>

      <Link
        href={`${platformUrl}/${postId}`}
        onClick={markSeen}
        className="group/link flex min-w-0 flex-1 flex-col items-stretch"
      >
        <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
          {isComment ? (
            <span className="truncate">
              Comment · <span className="text-foreground/80">“{title}”</span>
            </span>
          ) : (
            <span className="capitalize">
              {capitalizeFirstLetter(category || "")}
            </span>
          )}
          {!isComment && status && (
            <>
              <span className="text-[8px]">•</span>
              <span
                className={cn("capitalize", `text-${status.replace(" ", "-")}`)}
              >
                {status}
              </span>
            </>
          )}
        </div>

        {!isComment && (
          <h3
            className={cn(
              "mt-0.5 text-sm group-hover/link:underline",
              isUnseen ? "font-semibold" : "font-medium",
            )}
          >
            {title}
          </h3>
        )}

        <TiptapOutput
          content={content}
          forbiddenTags={["a", "pre", "img"]}
          className={cn(
            "text-muted-foreground! mt-1 line-clamp-1 text-sm! sm:line-clamp-2",
            isComment && isUnseen && "text-foreground! font-medium!",
          )}
        />

        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <Avatar className="size-4">
              <AvatarImage src={authorPhotoURL || undefined} alt="" />
              <AvatarFallback className="text-[9px]">
                {authorName?.charAt(0) || <UserIcon className="size-2.5" />}
              </AvatarFallback>
            </Avatar>
            <span className="text-foreground/80 font-medium">
              {authorName || "Anonymous"}
            </span>
          </span>
          <span className="text-[8px]">•</span>
          <span>{timeAgo.format(createdAt, "mini-now")} ago</span>
          <span className="text-[8px]">•</span>
          <span className="flex items-center gap-0.5">
            <ArrowBigUp className="size-3.5" />
            {upvotes}
          </span>
          {!isComment && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="size-3" />
              {commentCount ?? 0}
            </span>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-0.5">
        {isUnseen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mark as read"
                onClick={markSeen}
                className="text-muted-foreground hover:text-primary size-7 opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
              >
                <Check className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark as read</TooltipContent>
          </Tooltip>
        )}
        {isComment ? (
          <CommentsOptionsMenu postId={postId} commentId={id} />
        ) : (
          <FeedbackPostOptionsMenu postId={postId} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` — Expected: clean (`authorPhotoURL` exists on `ActivityFeedItem` from Task 1).
Run: `npm run lint` — Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/app/activity-feed/list-item.tsx
git commit -m "feat(activity): category-led row with author, upvotes, comments + unseen accent

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Rewrite the loading skeleton to match the new row

**Files:**
- Rewrite: `components/app/activity-feed/loading.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `components/app/activity-feed/loading.tsx` with:

```tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ActivityFeedLoading() {
  return (
    <div className="flex flex-col items-stretch">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="border-border flex items-start gap-3 border-b py-4 pr-2 pl-3 last:border-b-0"
        >
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-[55%]" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run lint` — Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/app/activity-feed/loading.tsx
git commit -m "feat(activity): skeleton matches new row layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Create the Empty states

**Files:**
- Create: `components/app/activity-feed/empty.tsx`

- [ ] **Step 1: Create the file**

Create `components/app/activity-feed/empty.tsx` with:

```tsx
"use client";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { CheckCheck, Inbox, SearchX } from "lucide-react";

export type ActivityEmptyVariant =
  | "platform"
  | "caught-up"
  | "search"
  | "filter";

export function ActivityFeedEmpty({
  variant,
  onReset,
}: {
  variant: ActivityEmptyVariant;
  onReset?: () => void;
}) {
  const config = {
    platform: {
      icon: <Inbox />,
      title: "No activity yet",
      description:
        "Feedback and comments from your users will show up here as they come in.",
      actionLabel: null as string | null,
    },
    "caught-up": {
      icon: <CheckCheck />,
      title: "You’re all caught up",
      description: "There’s nothing new to review right now.",
      actionLabel: "Show all activity",
    },
    search: {
      icon: <SearchX />,
      title: "No matches found",
      description: "No activity matches your search.",
      actionLabel: "Clear search",
    },
    filter: {
      icon: <SearchX />,
      title: "Nothing here",
      description: "No activity matches the current filters.",
      actionLabel: "Reset filters",
    },
  }[variant];

  return (
    <Empty className="border-0 py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">{config.icon}</EmptyMedia>
        <EmptyTitle>{config.title}</EmptyTitle>
        <EmptyDescription>{config.description}</EmptyDescription>
      </EmptyHeader>
      {config.actionLabel && onReset && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onReset}>
            {config.actionLabel}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run lint` — Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/app/activity-feed/empty.tsx
git commit -m "feat(activity): empty states (platform / caught-up / search / filter)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Create the header (title + unseen subtitle + Mark all as read)

**Files:**
- Create: `components/app/activity-feed/header.tsx`

- [ ] **Step 1: Create the file**

Create `components/app/activity-feed/header.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSetAllActivitiesSeen } from "@/hooks/use-set-all-activities-seen";
import { Check, CheckCheck } from "lucide-react";

export function ActivityFeedHeader({ unseenCount }: { unseenCount: number }) {
  const [isDone, setIsDone] = useState(false);
  const markAllSeen = useSetAllActivitiesSeen();

  const hasUnseen = unseenCount > 0;

  const handleClick = async () => {
    await markAllSeen.mutateAsync();
    setIsDone(true);
    setTimeout(() => setIsDone(false), 2500);
  };

  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="h5">Activity</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {hasUnseen
            ? `${unseenCount} new since you last looked`
            : "You’re all caught up"}
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        loading={markAllSeen.isPending}
        disabled={!hasUnseen && !isDone}
        className="shrink-0 gap-1.5"
      >
        {isDone ? (
          <>
            <Check className="size-4" /> Done
          </>
        ) : (
          <>
            <CheckCheck className="size-4" /> Mark all as read
          </>
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` — Expected: clean (`Button` accepts a `loading` prop — already used in the current `index.tsx`).
Run: `npm run lint` — Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/app/activity-feed/header.tsx
git commit -m "feat(activity): header with unseen subtitle + labeled mark-all-as-read

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 — The flip (atomic switch to the new system)

> One cohesive change: reshape the shared atom, swap the tRPC `page`→`cursor`, switch the hook to `useInfiniteQuery`, add the toolbar, rewrite `list.tsx` and `index.tsx`, and delete the dead files. **Do all steps before verifying** — intermediate steps will not typecheck. Verify and commit once at the end (Step 9).

### Task 9: Execute the flip

**Files:**
- Modify: `lib/atoms.ts`, `trpc/get-activity-feed.ts`, `hooks/use-activity-feed.ts`
- Create: `components/app/activity-feed/toolbar.tsx`
- Rewrite: `components/app/activity-feed/list.tsx`, `components/app/activity-feed/index.tsx`
- Delete: `components/app/activity-feed/list-header.tsx`, `components/app/activity-feed/list-pagination.tsx`

- [ ] **Step 1: Reshape `activtyFeedStateAtom`**

In `lib/atoms.ts`, replace the entire `activtyFeedStateAtom` declaration (keep the existing `FeedbackOrderBy` / `FeedbackStatus` imports at the top of the file) with:

```ts
export const activtyFeedStateAtom = atomWithReset<{
  searchValue: string;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  category: "all" | "idea" | "issue" | "general feedback" | "comments";
  unseenOnly: boolean;
}>({
  searchValue: "",
  orderBy: "newest",
  status: null,
  category: "all",
  unseenOnly: false,
});
```

- [ ] **Step 2: Swap the tRPC procedure to a `cursor` + `nextCursor` shape**

Replace the entire contents of `trpc/get-activity-feed.ts` with:

```ts
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedQuery } from "@/queries/get-activity-feed";
import {
  feedbackCategoriesSchema,
  feedbackOrderBySchema,
  feedbackStatusSchema,
} from "@/lib/schemas";

export const getActivityFeed = adminProcedure
  .input(
    z.object({
      cursor: z.number().min(1).nullish(),
      pageSize: z.number().min(1).max(100),
      orderBy: feedbackOrderBySchema,
      status: feedbackStatusSchema,
      categories: feedbackCategoriesSchema,
      excludeFeedback: z.boolean(),
      excludeComments: z.boolean(),
      searchValue: z.string().trim().max(500),
      unseenOnly: z.boolean(),
    }),
  )
  .query(
    async ({
      input: {
        cursor,
        pageSize,
        orderBy,
        status,
        categories,
        excludeFeedback,
        excludeComments,
        searchValue,
        unseenOnly,
      },
      ctx: { orgId, userId },
    }) => {
      const page = cursor ?? 1;

      const { items, totalItemsCount, totalPages, currentPage } =
        await getActivityFeedQuery({
          orgId,
          userId,
          page,
          pageSize,
          orderBy,
          status,
          categories,
          excludeFeedback,
          excludeComments,
          searchValue,
          unseenOnly,
        });

      const nextCursor = currentPage < totalPages ? currentPage + 1 : undefined;

      return {
        items,
        totalItemsCount,
        totalPages,
        currentPage,
        nextCursor,
      };
    },
  );
```

- [ ] **Step 3: Switch the hook to `useInfiniteQuery`**

Replace the entire contents of `hooks/use-activity-feed.ts` with:

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import {
  FeedbackCategories,
  FeedbackOrderBy,
  FeedbackStatus,
} from "@/lib/typings";

export function useActivityFeed({
  enabled,
  pageSize,
  orderBy,
  status,
  categories,
  excludeFeedback,
  excludeComments,
  searchValue,
  unseenOnly,
}: {
  enabled: boolean;
  pageSize: number;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  categories: FeedbackCategories;
  excludeFeedback: boolean;
  excludeComments: boolean;
  searchValue: string;
  unseenOnly: boolean;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActivityFeed.infiniteQueryOptions(
    {
      pageSize,
      orderBy,
      status,
      categories,
      excludeFeedback,
      excludeComments,
      searchValue,
      unseenOnly,
    },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return { queryKey, query };
}
```

- [ ] **Step 4: Create the toolbar**

Create `components/app/activity-feed/toolbar.tsx` with:

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
  counts,
  unseen,
}: {
  counts: Record<ActivityCategory, number>;
  unseen: Record<ActivityCategory, boolean>;
}) {
  const [state, setState] = useAtom(activtyFeedStateAtom);
  const { category, orderBy, status, unseenOnly } = state;

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
    <div className="mb-4 flex flex-col gap-3">
      <ActivityCategoryFilter
        value={category}
        counts={counts}
        unseen={unseen}
        commentsDisabled={status !== null}
        onChange={handleCategory}
      />

      <div className="flex items-center justify-between gap-2">
        <Toggle
          variant="outline"
          size="sm"
          pressed={unseenOnly}
          onPressedChange={handleUnseen}
          aria-label="Show unseen only"
          className="shrink-0"
        >
          Unseen only
        </Toggle>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <SortingFilteringDropdown
            orderBy={orderBy}
            status={status}
            onChange={handleSortingFiltering}
          />
          <ActivityFeedSearchInput onDebouncedChange={handleSearch} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `list.tsx`**

Replace the entire contents of `components/app/activity-feed/list.tsx` with:

```tsx
"use client";

import { useAtom } from "jotai";
import { activtyFeedStateAtom } from "@/lib/atoms";
import { FeedbackCategories } from "@/lib/typings";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { useInView } from "react-intersection-observer";
import { Spinner } from "@/components/ui/spinner";
import { Error } from "@/components/ui/error";
import { ActivityFeedListItems } from "./list-items";
import { ActivityFeedLoading } from "./loading";
import { ActivityFeedEmpty } from "./empty";

export function ActivityFeedList() {
  const [state, setState] = useAtom(activtyFeedStateAtom);
  const { category, orderBy, status, searchValue, unseenOnly } = state;

  const isSearchActive = searchValue.length > 0;

  // Map the single-select category onto the existing query params.
  let categories: FeedbackCategories = null;
  let excludeComments = false;
  let excludeFeedback = false;

  if (category === "comments") {
    excludeFeedback = true;
  } else if (category !== "all") {
    categories = [category];
    excludeComments = true;
  }

  const {
    query: {
      data,
      isPending,
      isError,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
    },
  } = useActivityFeed({
    enabled: true,
    pageSize: 20,
    orderBy,
    status,
    categories,
    excludeComments,
    excludeFeedback,
    searchValue,
    unseenOnly,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const isLoaded = !isPending && !isError;
  const hasItems = items.length > 0;
  const isEmpty = isLoaded && !hasItems;
  const hasFilter = category !== "all" || status !== null;

  const { ref } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

  const resetSearch = () => setState((prev) => ({ ...prev, searchValue: "" }));
  const resetUnseen = () =>
    setState((prev) => ({ ...prev, unseenOnly: false }));
  const resetFilters = () =>
    setState((prev) => ({ ...prev, category: "all", status: null }));

  return (
    <div className="border-border bg-background overflow-hidden rounded-lg border shadow-xs">
      {isPending && <ActivityFeedLoading />}

      {isError && (
        <div className="p-4">
          <Error
            title="Could not load activity"
            description="Something went wrong while loading the activity feed. Please try again."
          />
        </div>
      )}

      {isEmpty && isSearchActive && (
        <ActivityFeedEmpty variant="search" onReset={resetSearch} />
      )}
      {isEmpty && !isSearchActive && unseenOnly && (
        <ActivityFeedEmpty variant="caught-up" onReset={resetUnseen} />
      )}
      {isEmpty && !isSearchActive && !unseenOnly && hasFilter && (
        <ActivityFeedEmpty variant="filter" onReset={resetFilters} />
      )}
      {isEmpty && !isSearchActive && !unseenOnly && !hasFilter && (
        <ActivityFeedEmpty variant="platform" />
      )}

      {isLoaded && hasItems && (
        <>
          <ActivityFeedListItems items={items} />
          <span className="sr-only" aria-live="polite">
            {isFetchingNextPage ? "Loading more activity" : ""}
          </span>
          {isFetchingNextPage && (
            <div className="flex items-center justify-start gap-2 p-4">
              <Spinner />
              <span className="text-sm">Loading more activity...</span>
            </div>
          )}
          <div ref={ref} className="h-1 w-full" />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `index.tsx`**

Replace the entire contents of `components/app/activity-feed/index.tsx` with:

```tsx
"use client";

import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";
import { ActivityFeedHeader } from "./header";
import { ActivityFeedToolbar } from "./toolbar";
import { ActivityFeedList } from "./list";
import { ActivityCategory } from "./category-filter";

export function ActivityFeed() {
  const {
    query: { data: metaData },
  } = useActivityFeedMetaData({ enabled: true });

  const totalUnseen = metaData?.totalUnseenCount ?? 0;

  const counts: Record<ActivityCategory, number> = {
    all:
      (metaData?.totalIdeasPostCount ?? 0) +
      (metaData?.totalIssuesPostCount ?? 0) +
      (metaData?.totalGeneralFeedbackPostCount ?? 0) +
      (metaData?.totalCommentCount ?? 0),
    idea: metaData?.totalIdeasPostCount ?? 0,
    issue: metaData?.totalIssuesPostCount ?? 0,
    "general feedback": metaData?.totalGeneralFeedbackPostCount ?? 0,
    comments: metaData?.totalCommentCount ?? 0,
  };

  const unseen: Record<ActivityCategory, boolean> = {
    all: totalUnseen > 0,
    idea: (metaData?.unseenIdeasPostCount ?? 0) > 0,
    issue: (metaData?.unseenIssuesPostCount ?? 0) > 0,
    "general feedback": (metaData?.unseenGeneralFeedbackPostCount ?? 0) > 0,
    comments: (metaData?.unseenCommentCount ?? 0) > 0,
  };

  return (
    <div>
      <ActivityFeedHeader unseenCount={totalUnseen} />
      <ActivityFeedToolbar counts={counts} unseen={unseen} />
      <ActivityFeedList />
    </div>
  );
}
```

- [ ] **Step 7: Delete the dead files**

```bash
git rm components/app/activity-feed/list-header.tsx components/app/activity-feed/list-pagination.tsx
```

- [ ] **Step 8: Typecheck, lint, build**

Run: `npx tsc --noEmit`
Expected: clean — no errors. (If you see "Cannot find name `page`/`ideasSelected`" the rewrite of `list.tsx`/atom is incomplete.)

Run: `npm run lint`
Expected: no new errors in changed files.

Run: `npm run build`
Expected: build succeeds. Confirms tRPC `infiniteQueryOptions` types line up (the `cursor` input + `nextCursor` return) and no page/SSR breakage.

- [ ] **Step 9: Commit the flip**

```bash
git add lib/atoms.ts trpc/get-activity-feed.ts hooks/use-activity-feed.ts components/app/activity-feed/
git commit -m "feat(activity): consolidated toolbar, unseen filter, infinite scroll

Reshape activity-feed atom (single-select category + unseenOnly), swap
the tRPC page input for a numeric cursor + nextCursor, switch the hook to
useInfiniteQuery, add the segmented toolbar, rewrite list + index, and
remove the stat-card grid / pagination.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4 — Manual verification

### Task 10: Walk through the page in the running app

**Files:** none (manual).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open an admin board's activity page: `http://<org>.localhost:3000/admin/activity` (or use the live local subdomain you normally develop against; Activity is the default `/admin` redirect target).

- [ ] **Step 2: Verify the layout & data**

Confirm:
- Header shows "Activity" + "N new since you last looked" (or "You’re all caught up" at 0 unseen).
- Segmented filter shows All / Ideas / Issues / General / Comments with counts; segments with unseen items show a blue dot.
- No "Updated status to …" entries appear in the feed, and the Comments count excludes them.
- Rows show category icon, title (posts), 1–2 line snippet, author avatar + name, time, ▲ upvotes, and 💬 comment count (posts). Unseen rows have the left accent bar + bold title.

- [ ] **Step 3: Verify interactions**

- Click each segment → list filters; selecting a status in the sort/filter dropdown disables the Comments segment (and switches away from it if it was active).
- Toggle "Unseen only" → only unseen items remain; clearing all unseen (or "Mark all as read") shows the "You’re all caught up" empty state with a "Show all activity" reset.
- Type a search (≥2 chars) → semantic results; clearing returns to the full feed; a no-match search shows the search empty state.
- Scroll to the bottom of a long feed → next page auto-loads with the "Loading more activity…" spinner (no pagination control).
- Hover an unseen row → "Mark as read" check appears; clicking it marks read without navigating. Clicking a row opens the post and marks it read.
- Open a row's `⋯` menu → status change / delete still work; counts and the feed update afterward.

- [ ] **Step 4: Verify theme + responsive**

- Toggle dark mode (header theme switch) → accent, status colors, borders all read correctly.
- Narrow the viewport → the segmented control scrolls horizontally; the unseen/sort/search row wraps; snippets clamp to 1 line.

- [ ] **Step 5: (Optional) Finish the branch**

If everything checks out, use the `superpowers:finishing-a-development-branch` skill to open a PR or merge.

---

## Self-review — spec coverage map

| Spec requirement | Task(s) |
|---|---|
| Hide "Updated status to…" from feed | Task 1 (feed query) |
| Hide them from counts (meta + per-post commentCount) | Task 1 (commentCount subquery), Task 2 (meta) |
| `unseenOnly` filter (query + input + toggle) | Task 1 (query), Task 9 S2 (tRPC), S4 (toolbar toggle), S3 (hook) |
| Author avatar (`authorPhotoURL`) | Task 1 (query + typings), Task 5 (row) |
| Header: title + unseen subtitle + Mark all read | Task 8 |
| Segmented category filter (counts + unseen dots, single-select) | Task 4, wired Task 9 S4/S6 |
| Comments segment disabled while status active | Task 4 (`commentsDisabled`), Task 9 S4 (logic) |
| Category → params mapping table | Task 9 S5 (`list.tsx`) |
| Always-visible search | Task 3 |
| Sort/status reuse | Task 9 S4 (`SortingFilteringDropdown`) |
| Infinite scroll (cursor + nextCursor + useInfiniteQuery + sentinel) | Task 9 S2/S3/S5 |
| Comfortable category-led rows + unseen accent + hover mark-read | Task 5 |
| Empty/Error/loading states | Task 6 (loading), Task 7 (empty), Task 9 S5 (Error + wiring) |
| Atom reshape; `GlobalOrgState` RESET still valid | Task 9 S1 (no GlobalOrgState change needed) |
| Delete `list-header` + `list-pagination` | Task 9 S7 |
| Accessibility (aria-live, aria-pressed, aria-labels, status text+color) | Task 4, 5, 9 S4/S5 |
| No DB schema changes | (whole plan — none introduced) |

All spec sections map to at least one task. No placeholders; types/props are consistent across tasks (`ActivityCategory`, `ActivityFeedItem.authorPhotoURL`, `unseenOnly`, `nextCursor`).
