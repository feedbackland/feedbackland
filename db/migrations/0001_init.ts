import "server-only";
import { sql, type Kysely } from "kysely";
import { vectorMetadata } from "../vector";

// BEGIN generated Better Auth 1.7.6 DDL. Compared verbatim with db:auth-ddl.
export const AUTH_DDL = `create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "role" text not null);

create table "auth_session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade, "scope" text);

create table "auth_account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "auth_verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "auth_rate_limit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);

create index "auth_session_userId_idx" on "auth_session" ("userId");

create index "auth_account_userId_idx" on "auth_account" ("userId");

create index "auth_verification_identifier_idx" on "auth_verification" ("identifier");`;
// END generated block. Library migrators never execute in the application.

export async function up(db: Kysely<unknown>) {
  const vector = vectorMetadata();
  const type = `${quote(vector.schema)}.${vector.kind}(${vector.dimensions})`;
  const opclass = `${quote(vector.schema)}.${vector.kind}_cosine_ops`;
  await sql.raw(AUTH_DDL).execute(db);
  await sql
    .raw(
      `
alter table "user" alter column role set default 'user', add check (role in ('admin','user'));
alter table auth_session alter column scope set default 'first-party', add check (scope in ('first-party','embedded'));
create type feedback_category as enum ('idea','issue','general feedback');
create type feedback_status as enum ('under consideration','planned','in progress','done','declined');
create table images (
  id uuid primary key default gen_random_uuid(), bytes bytea not null,
  "contentType" text not null check ("contentType" in ('image/png','image/jpeg','image/gif','image/webp')),
  "byteSize" integer not null check ("byteSize">0 and "byteSize"=octet_length(bytes)),
  width integer not null check(width>0), height integer not null check(height>0), "createdAt" timestamptz not null default now()
);
create table settings (
  id integer primary key default 1 check(id=1), "platformTitle" text not null default 'Feedback',
  "platformDescription" text, "logoImageId" uuid references images(id) on delete set null,
  "allowIndexing" boolean not null default true, "setupCompletedAt" timestamptz,
  revision bigint not null default 1 check(revision>0), "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now()
);
create index settings_logo_idx on settings("logoImageId");
create table instance_secret (id integer primary key default 1 check(id=1), "authSecret" text, "setupCode" text, "setupCodeGenerated" boolean not null default false, "createdAt" timestamptz not null default now());
create table feedback (
  id uuid primary key default gen_random_uuid(), "authorId" text references "user"(id) on delete set null,
  title text not null, description text not null, "plainText" text not null,
  category feedback_category, status feedback_status, upvotes numeric not null default 0,
  embedding ${type}, "embeddingSkipped" boolean not null default false,
  revision bigint not null default 1 check(revision>0),
  "moderationState" text not null check("moderationState" in ('disabled','screened','screened-text','unscreened')),
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now()
);
create table comment (
  id uuid primary key default gen_random_uuid(), "postId" uuid not null references feedback(id) on delete cascade,
  "parentCommentId" uuid, unique(id,"postId"),
  foreign key("parentCommentId","postId") references comment(id,"postId") on delete cascade,
  check("parentCommentId" is null or "parentCommentId"<>id),
  "authorId" text references "user"(id) on delete set null, content text not null, "plainText" text not null,
  upvotes numeric not null default 0, embedding ${type}, "embeddingSkipped" boolean not null default false,
  revision bigint not null default 1 check(revision>0),
  "moderationState" text not null check("moderationState" in ('disabled','screened','screened-text','unscreened')),
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now()
);
create index feedback_author_idx on feedback("authorId");
create index feedback_created_idx on feedback("createdAt" desc,id);
create index comment_author_idx on comment("authorId");
create index comment_post_idx on comment("postId");
create index comment_parent_post_idx on comment("parentCommentId","postId");
create index feedback_embedding_idx on feedback using hnsw(embedding ${opclass});
create index comment_embedding_idx on comment using hnsw(embedding ${opclass});
create index feedback_backfill_idx on feedback(id) where embedding is null and not "embeddingSkipped";
create index comment_backfill_idx on comment(id) where embedding is null and not "embeddingSkipped";
create table image_ref (
  "imageId" uuid not null references images(id) on delete cascade,
  "postId" uuid references feedback(id) on delete cascade, "commentId" uuid references comment(id) on delete cascade,
  check(num_nonnulls("postId","commentId")=1)
);
create unique index image_ref_post_idx on image_ref("postId","imageId") where "postId" is not null;
create unique index image_ref_comment_idx on image_ref("commentId","imageId") where "commentId" is not null;
create index image_ref_image_idx on image_ref("imageId");
create table insights (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null, ids text[] not null,
  category feedback_category, status feedback_status, priority numeric not null default 0, upvotes numeric not null default 0,
  "commentCount" numeric not null default 0, effort text check(effort in ('s','m','l')), reach numeric not null default 0,
  momentum numeric not null default 0, signals jsonb, "firstSeenAt" timestamptz not null default now(),
  "lastSeenAt" timestamptz not null default now(), "isArchived" boolean not null default false, "createdAt" timestamptz not null default now()
);
create index insights_archived_idx on insights("isArchived");
create table insight_reports (
  id bigint generated by default as identity primary key, "createdAt" timestamptz not null default now(),
  "postsTotal" numeric not null default 0, "postsAnalyzed" numeric not null default 0, "postsClustered" numeric not null default 0,
  "insightCount" numeric not null default 0, "newInsightCount" numeric not null default 0, "archivedInsightCount" numeric not null default 0,
  model text, status text not null check(status in ('running','succeeded','failed')),
  stage text not null check(stage in ('admitting','admitted','complete')), "startedAt" timestamptz not null default now(),
  "heartbeatAt" timestamptz not null default now(), "finishedAt" timestamptz, error text,
  "configToken" text not null, owner text not null, fence bigint not null check(fence>0),
  "inputSnapshot" jsonb check(octet_length("inputSnapshot"::text)<=2097152), "inputHash" text,
  "requestPlan" jsonb, "reservationId" text, "reservationDay" date, "reservationCount" integer check("reservationCount">=0)
);
create unique index insight_reports_running_idx on insight_reports((1)) where status='running';
create index insight_reports_created_idx on insight_reports("createdAt" desc);
create table admin_invites (
  id uuid primary key default gen_random_uuid(), email text not null, token uuid not null default gen_random_uuid(),
  "createdAt" timestamptz not null default now(), "expiresAt" timestamptz not null default now()+interval '7 days'
);
create index admin_invites_token_idx on admin_invites(token);
create table moderation_event (
  id bigint generated always as identity primary key, "createdAt" timestamptz not null default now(),
  "postId" uuid references feedback(id) on delete cascade, "commentId" uuid references comment(id) on delete cascade,
  check(num_nonnulls("postId","commentId")=1), "contentRevision" bigint not null check("contentRevision">0),
  reason text not null check(reason in ('provider-auth','provider-credit','provider-rate','provider-error','daily-limit','key-unreadable','limiter-error','vision-not-screened','timeout','unavailable'))
);
create unique index moderation_post_revision_idx on moderation_event("postId","contentRevision") where "postId" is not null;
create unique index moderation_comment_revision_idx on moderation_event("commentId","contentRevision") where "commentId" is not null;
create index moderation_created_idx on moderation_event("createdAt");
create table job_lease (name text primary key, holder text not null, until timestamptz not null, fence bigint not null check(fence>0));
create table ai_settings (
  id integer primary key default 1 check(id=1), enabled boolean, "apiKey" text, "apiKeyLast4" text, "apiKeySetAt" timestamptz,
  "apiKeyDigest" text, "effectiveConfigToken" text, "creditWaitUntil" timestamptz, "creditWaitConfigToken" text,
  options jsonb not null default '{}', "indexFingerprint" jsonb, "indexEpoch" bigint not null default 1 check("indexEpoch">0),
  "keepOffAt" timestamptz, "keepOffBy" text references "user"(id) on delete set null, "lastCheck" jsonb,
  revision bigint not null default 1 check(revision>0), "updatedAt" timestamptz not null default now(),
  "updatedBy" text references "user"(id) on delete set null
);
create index ai_settings_keep_off_idx on ai_settings("keepOffBy");
create index ai_settings_updated_by_idx on ai_settings("updatedBy");
create table llm_usage (
  day date not null, feature text not null check(feature in ('moderation','title','embed-write','embed-query','backfill','insights','ask-ai','rewrite','check','probe')),
  calls integer not null default 0, errors integer not null default 0, "uncostedCalls" integer not null default 0,
  "inputTokens" bigint not null default 0, "outputTokens" bigint not null default 0, "costUsd" numeric(20,12) not null default 0, primary key(day,feature)
);
create table admin_notice (
  "userId" text not null references "user"(id) on delete cascade,
  notice text not null check(notice in ('ai-off-card','ai-unseen-notice','ai-broken-card')),
  "dismissedAt" timestamptz not null default now(), "hiddenUntil" timestamptz, primary key("userId",notice)
);
create table user_upvote (
  "userId" text not null references "user"(id) on delete cascade, "contentId" uuid not null,
  "createdAt" timestamptz not null default now(), primary key("userId","contentId")
);
create index user_upvote_content_idx on user_upvote("contentId");
create table activity_seen ("userId" text not null references "user"(id) on delete cascade, "itemId" uuid not null, primary key("userId","itemId"));
create table rate_limit (key text primary key, count integer not null default 0, "windowStart" timestamptz not null default now());
create table auth_runtime (id integer primary key default 1 check(id=1), "discoveryEpoch" bigint not null default 1 check("discoveryEpoch">0));
create table ai_health (
  "configToken" text not null, capability text not null check(capability in ('chat','embeddings')),
  "nextSequence" bigint not null default 0, "lastAppliedSequence" bigint not null default 0,
  "lastSuccessAt" timestamptz, "lastFailureAt" timestamptz, "failingSince" timestamptz,
  "lastReason" text check("lastReason" in ('provider-auth','provider-credit','provider-rate','provider-error','timeout','unavailable')),
  "failuresLastHour" integer not null default 0 check("failuresLastHour" between 0 and 1000000), "failureWindowStart" timestamptz,
  "updatedAt" timestamptz not null default now(), primary key("configToken",capability)
);
create table search_session (
  "capabilityHash" text primary key, "queryHash" text not null, filters jsonb not null default '{}',
  surface text not null check(surface in ('board','activity')), "userId" text references "user"(id) on delete cascade,
  check(surface<>'activity' or "userId" is not null), mode text not null check(mode in ('semantic','exact')),
  fingerprint jsonb, epoch bigint, "queryVector" bytea check(octet_length("queryVector")<=16000),
  results jsonb not null default '[]' check(jsonb_typeof(results)='array' and jsonb_array_length(results)<=1000),
  check(coalesce(octet_length("queryVector"),0)+octet_length(results::text)+octet_length(filters::text)<=131072),
  status text not null check(status in ('pending','ready','failed')), "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null default now()+interval '10 minutes', truncated boolean not null default false
);
create index search_session_expiry_idx on search_session("expiresAt");
create index search_session_user_idx on search_session("userId");
create table recovery_claim (
  "codeDigest" text not null, "userId" text not null references "user"(id) on delete cascade,
  "operationId" uuid not null default gen_random_uuid(), owner text not null,
  status text not null check(status in ('resetting','reset','promoted')), "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null default now()+interval '15 minutes', failure text check(failure in ('expired','reset-failed','account-changed')),
  primary key("codeDigest","userId")
);
create index recovery_claim_user_idx on recovery_claim("userId");
`,
    )
    .execute(db);
}
function quote(identifier: string) {
  return '"' + identifier.replaceAll('"', '""') + '"';
}
// New-install, pre-RC schema. Rollback is an image revert + disposable DB reset;
// a runtime down migration must never destroy an operator's data.
