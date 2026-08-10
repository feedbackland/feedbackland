-- Security hardening.
--
-- Run this once against an existing Feedbackland database (Supabase → SQL
-- Editor → paste → Run). Fresh installs get all of this from db/schema.sql and
-- do not need to run it. Every statement is idempotent, so re-running is safe.
--
-- What changes:
--   * The public `images` bucket no longer grants anonymous UPDATE and DELETE.
--     The app only ever uploads images; those two policies let anyone with the
--     public anon key overwrite or wipe every stored image. Uploads are kept.
--   * Adds a `rate_limit` table backing per-IP / per-org limits on the feedback
--     endpoints, each of which spends LLM calls. Without it, anyone who learns
--     an org id could drive unbounded OpenRouter usage.
--
-- No existing feedback, comment, user, or org row is touched.

DROP POLICY IF EXISTS "Allow anon updates" ON "storage"."objects";
DROP POLICY IF EXISTS "Allow anon deletes" ON "storage"."objects";

CREATE TABLE IF NOT EXISTS "public"."rate_limit" (
    "key" "text" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "windowStart" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("key")
);
