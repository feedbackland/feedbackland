-- Feedback Insights overhaul.
--
-- Run this once against an existing Feedbackland database (Supabase → SQL
-- Editor → paste → Run). Fresh installs get all of this from db/schema.sql and
-- do not need to run it. Every statement is idempotent, so re-running is safe.
--
-- What changes:
--   * Insights now persist across regenerations instead of being deleted and
--     re-created, so week-over-week deltas survive a re-run.
--   * Each insight stores its scoring inputs so the priority score can be
--     explained instead of asserted.
--   * insight_reports becomes the run log behind the coverage strip
--     ("84 posts → 19 insights · 6 new").
--
-- No existing column is rewritten and no feedback is touched.

-- Anyone who ran an earlier draft of this file has the run-log counters under
-- their old "theme" names. Rename before the ADDs below, or those would create
-- a second, empty set of columns. Postgres has no RENAME COLUMN IF EXISTS, so
-- the guard is explicit; a re-run finds nothing to do.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'insight_reports'
                 AND column_name = 'themeCount') THEN
        ALTER TABLE "public"."insight_reports"
            RENAME COLUMN "themeCount" TO "insightCount";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'insight_reports'
                 AND column_name = 'newThemeCount') THEN
        ALTER TABLE "public"."insight_reports"
            RENAME COLUMN "newThemeCount" TO "newInsightCount";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'insight_reports'
                 AND column_name = 'archivedThemeCount') THEN
        ALTER TABLE "public"."insight_reports"
            RENAME COLUMN "archivedThemeCount" TO "archivedInsightCount";
    END IF;
END $$;

ALTER TABLE "public"."insights"
    ADD COLUMN IF NOT EXISTS "effort" "text",
    ADD COLUMN IF NOT EXISTS "reach" numeric DEFAULT '0'::numeric NOT NULL,
    ADD COLUMN IF NOT EXISTS "momentum" numeric DEFAULT '0'::numeric NOT NULL,
    ADD COLUMN IF NOT EXISTS "signals" "jsonb",
    ADD COLUMN IF NOT EXISTS "firstSeenAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    ADD COLUMN IF NOT EXISTS "lastSeenAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    ADD COLUMN IF NOT EXISTS "isArchived" boolean DEFAULT false NOT NULL;

ALTER TABLE "public"."insight_reports"
    ADD COLUMN IF NOT EXISTS "postsTotal" numeric DEFAULT '0'::numeric NOT NULL,
    ADD COLUMN IF NOT EXISTS "postsAnalyzed" numeric DEFAULT '0'::numeric NOT NULL,
    ADD COLUMN IF NOT EXISTS "postsClustered" numeric DEFAULT '0'::numeric NOT NULL,
    ADD COLUMN IF NOT EXISTS "insightCount" numeric DEFAULT '0'::numeric NOT NULL,
    ADD COLUMN IF NOT EXISTS "newInsightCount" numeric DEFAULT '0'::numeric NOT NULL,
    ADD COLUMN IF NOT EXISTS "archivedInsightCount" numeric DEFAULT '0'::numeric NOT NULL,
    ADD COLUMN IF NOT EXISTS "model" "text";

-- Insights that predate this migration got firstSeenAt = lastSeenAt = now()
-- from the column defaults, which is exactly the signature the UI reads as "new
-- in the latest run". Point firstSeenAt at when the row was actually created so
-- an existing board does not light up with false NEW badges. Rows written by
-- the current generator always have signals, so they are left alone.
UPDATE "public"."insights"
SET "firstSeenAt" = "createdAt"
WHERE "signals" IS NULL AND "firstSeenAt" = "lastSeenAt";

CREATE INDEX IF NOT EXISTS "insights_org_archived_idx"
    ON "public"."insights" USING "btree" ("orgId", "isArchived");

CREATE INDEX IF NOT EXISTS "insight_reports_org_created_idx"
    ON "public"."insight_reports" USING "btree" ("orgId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "user_upvote_content_id_idx"
    ON "public"."user_upvote" USING "btree" ("contentId");

-- Earlier drafts of this migration added a "horizon" column for a Now/Next/
-- Later planning board, and a "kind" column (fix / feature / improvement).
-- Neither survived: the page reports insights and sets feedback statuses, and
-- an imperative title already says whether something is a fix or a feature.
-- Drop them if they are present. The run-log counters were also renamed off
-- "theme" onto "insight"; the renames are conditional so a re-run is safe.
ALTER TABLE "public"."insights"
    DROP COLUMN IF EXISTS "horizon",
    DROP COLUMN IF EXISTS "kind";
