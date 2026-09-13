# Single-tenant, vendor-neutral self-hosting

**Status:** approved design
**Date:** 2026-09-13

## Problem

Feedbackland has one deployment shape today, and it is the hosted one.
`feedbackland.com` is multi-tenant: each customer gets
`<subdomain>.feedbackland.com`, resolved by `proxy.ts` into the
`app/[orgSubdomain]/` route tree. Self-hosting reuses that machinery
unchanged, which produces two bad outcomes.

**It is not easy.** `SELFHOSTING.md` is 22 KB and ~550 lines. It asks the
operator to create four accounts (Supabase, Firebase, OpenRouter, Vercel),
fork the repository, **edit and commit a source file** (`firebaseConfig.ts`),
paste a SQL dump into a web console, collect ten environment values, and
authorise domains in a Firebase console. Steps 2 and 3 alone are roughly half
the document.

**It is vendor-locked.** Vercel is assumed, not chosen: there is no
Dockerfile, `getIsSubdirOrg()` hard-codes `vercel.app`, and `getVercelUrl()`
reads `VERCEL_URL` to build the operator's own board URL. Supabase is both the
database and the image store. Firebase is authentication. None of this is
required by the application's actual data model.

**And multi-tenancy is dead weight for a self-hoster.** Someone running
Feedbackland for their own product does not want organisations, a signup
funnel, or subdomains. They want one board. Today they get
`https://my-instance.vercel.app/my-org/admin`, a `/get-started` wizard, and a
"claim" step, because the hosted product needs those.

## Goals

1. `feedbackland.com` keeps full multi-tenancy — `tenant.feedbackland.com`,
   the org wizard, Firebase auth, Supabase storage — with **no behavioural
   change**.
2. The self-hosted build is **single-tenant**: one board, clean URLs (`/`,
   `/admin`, `/<postId>`), no org concept in the interface.
3. The self-hosted build is **trivial to run anywhere**: `docker compose up`,
   zero external accounts, zero environment values to fill in.
4. No vendor is *required* to self-host. Vercel remains a **supported
   secondary path**, not a requirement.

## Non-goals

- Migrating `feedbackland.com` off Firebase or Supabase. It stays as is.
- Multi-tenancy in the self-hosted build, in any form.
- Changing the published `feedbackland-react` npm package. See §9 — it
  already supports everything self-hosting needs.
- Changing the database schema's tenancy model. `orgId` stays on every row.

## The central idea

The application is **already** org-scoped end to end. Every query takes an
`orgId`; every tRPC procedure reads it from context. The only thing
multi-tenancy adds is *how `orgId` is derived from a request*.

> Tenant resolution becomes a strategy. Cloud derives it from the subdomain.
> Self-hosted resolves it to the single org row that exists.

Nothing else in the data model changes. That is what keeps the blast radius
on the hosted product small: the schema, the queries, the procedures and the
widget contract are all untouched.

Everything else in this document is orthogonal to tenancy — it is about
removing the three vendor couplings (Firebase, Supabase Storage, Vercel) and
making the LLM optional.

## Architecture: one repository, two build profiles

`SELF_HOSTED` becomes a **build-time profile selector**, because the
self-hosted artefact is a Docker image built once and shipped to everyone.

| | `cloud` profile (default) | `selfhost` profile |
|---|---|---|
| Built by | Vercel, from `main` | CI, published to GHCR |
| Tenancy | subdomain | the one org |
| Auth | Firebase | Better Auth on Postgres |
| Image storage | Supabase Storage | Postgres |
| LLM | required | optional |

Four ports, each with two adapters:

```
lib/tenancy/   types.ts  index.ts -> impl.cloud.ts    | impl.selfhost.ts
lib/auth/      types.ts  server.ts  client.tsx
                         -> impl.firebase.{ts,tsx}    | impl.local.{ts,tsx}
lib/storage/   types.ts  index.ts -> impl.supabase.ts | impl.postgres.ts
lib/ai/        capabilities.ts   (runtime flag — see §6)
```

### Adapter selection: bundler alias

`index.ts` re-exports from `./impl`, and `next.config.ts` aliases `./impl` to
the profile's file:

```ts
const profile = process.env.SELF_HOSTED === "true" ? "selfhost" : "cloud";

turbopack: {
  resolveAlias: {
    "@/lib/tenancy/impl": `./lib/tenancy/impl.${profile}.ts`,
    // ...one entry per port
  },
}
```

A bundler alias rather than a runtime `if` matters for three reasons:

- The Firebase SDK stays out of the self-hosted bundle and Better Auth's
  client stays out of the cloud bundle.
- `lib/firebase/client.ts` calls `initializeApp(firebaseConfig)` **at import
  time**. A runtime branch would still execute it in the self-hosted build,
  against a config that is not the operator's.
- The dead profile's code cannot be reached by accident.

`tsconfig.json` maps `@/lib/*/impl` to the `cloud` variant so `tsc --noEmit`
resolves; the two adapters implement the same `types.ts` interface, so which
one the type-checker sees is immaterial.

> **Risk — validate this first.** Turbopack is the default bundler for both
> `dev` and `build` in Next 16, and `turbopack.resolveAlias` aliasing a
> `@/`-prefixed path specifier to a relative file is the one mechanism in this
> design that is not already proven in this repository. It gets a spike before
> anything is built on it. **Fallback:** a ~10-line `prebuild` script that
> writes `lib/<port>/impl.ts` as a re-export of the chosen adapter. That is
> bundler-agnostic and works identically under dev, build and `tsc`; the cost
> is one generated, git-ignored file per port.

### Runtime versus build-time configuration

**Hard rule: anything a self-hoster configures must be runtime environment,
never `NEXT_PUBLIC_*`.** A prebuilt image is compiled once, before the
operator's values exist; a `NEXT_PUBLIC_` value would be frozen at CI time.

After this refactor the self-hosted profile needs **zero** runtime
`NEXT_PUBLIC_` variables:

- Supabase and Firebase values — not used by this profile at all.
- `OPENROUTER_API_KEY` — server-only; the client learns *whether* AI is
  available from the API (§6).
- Better Auth — server-only; the client talks to `/api/auth` on its own
  origin.
- The instance's public URL — derived from `window.location` on the client
  and from request headers on the server.

`SELF_HOSTED` / `NEXT_PUBLIC_SELF_HOSTED` remain build-time, which is correct:
they identify the artefact, not the deployment.

## §1 — Tenancy port

```ts
// lib/tenancy/types.ts
export type Tenancy = {
  readonly isMultiTenant: boolean;
  /** Server: the org this request belongs to, or null. */
  resolveOrgRef(req: Request): Promise<OrgRef | null>;
  /** Client: value for the `subdomain` header, or null to omit it. */
  tenantHeader(): string | null;
  /** Client: origin (+ org path in cloud subdir mode) for building links. */
  platformUrl(): string | null;
};
```

**`impl.cloud.ts`** wraps today's behaviour verbatim: `getSubdomain()`,
`getMaindomain()`, `getIsSubdirOrg()`, `getPlatformUrl()` move here from
`lib/utils.ts`, and `resolveOrgRef` reads the `subdomain` header exactly as
`createContext` does now.

**`impl.selfhost.ts`** ignores the `subdomain` header entirely and resolves
the single claimed org, memoised per process with a short TTL.

Ignoring the header is a security improvement, not just a simplification: it
removes a client-controlled input from the path that decides which org's data
a request may read.

`lib/trpc.ts` `createContext` and `app/api/chat/route.ts`'s
`resolveAdminOrgId` both call `resolveOrgRef`. Neither needs any other change.

## §2 — Single-tenant routing

The board must live at `/`, `/admin`, `/<postId>` while the route tree stays
`app/[orgSubdomain]/`. A constant sentinel segment plus a **`next.config.ts`
rewrite** achieves this:

```
rewrites  (beforeFiles):  /:path((?!api/|_next/|_/).*)  ->  /_/:path
redirects:                /_/:path*                     ->  /:path*
```

`_` is rejected by the existing `subdomainRegex`, so it can never collide
with a real org slug. The redirect makes the sentinel unreachable as a URL,
so it never appears in a browser address bar.

Two alternatives were rejected:

- **A second route tree** (`app/(single)/...` beside `app/[orgSubdomain]/`)
  fails to build: two different dynamic slug names at the same path level is
  a hard Next.js error.
- **Rewriting in `proxy.ts`** is how cloud does it, but
  [vercel/next.js#86122](https://github.com/vercel/next.js/issues/86122)
  reports `proxy.ts` silently not executing in `output: "standalone"` behind
  some reverse proxies. Correctness must not depend on middleware in a build
  whose whole point is running anywhere.

`proxy.ts` therefore becomes **cloud-only for routing**. It keeps setting the
`?embed=drawer` header in both profiles, but purely as a first-paint
optimisation: if it does not run, `EmbedProvider` resolves the surface on the
client and the drawer flashes once instead of breaking.

## §3 — Auth port

Firebase's real surface is small, so the port is small:

```ts
// server
verifyRequest(req: Request): Promise<{ uid: string; email: string | null } | null>

// client
signUpWithEmail / signInWithEmail / signOut / onAuthChange / getToken
signInWithGoogle / signInWithMicrosoft      // optional per profile
```

`hooks/use-auth.tsx` keeps its shape and its `upsertUser` mirror flow; only
the calls underneath change.

### Bearer tokens are load-bearing

The board is embedded in an iframe on customer domains. Cookie sessions would
be third-party cookies and blocked by Safari and Chrome. Firebase's
"ID token in the `Authorization` header" model is *why* the embedded drawer
works today, and the replacement must keep it. This rules out a cookie-session
library used in its default mode.

### `impl.firebase.*` (cloud)

Today's code, moved. `adminAuth.verifyIdToken` server-side; the Firebase web
SDK client-side. No behavioural change.

### `impl.local.*` (self-hosted)

[Better Auth](https://better-auth.com), configured as:

- `database: pool` — the existing `pg.Pool` from `db/db.ts`. Better Auth's
  built-in Kysely adapter drives it.
- `plugins: [bearer({ requireSignature: true })]` — sign-in returns the token
  in the `set-auth-token` response header; the client stores it and sends
  `Authorization: Bearer ...`; the server reads it with
  `auth.api.getSession({ headers })`. This mirrors the Firebase shape
  exactly, so `lib/trpc.ts` only swaps its verifier.
- `user: { modelName: "auth_user" }`, likewise `auth_session`,
  `auth_account`, `auth_verification` — the application already owns
  `public.user`, and that table must not be taken over.
- Better Auth's user id becomes the app's `user.id`. No schema change is
  needed: `public.user.id` is already `text`, because it holds a Firebase uid
  today.
- `emailAndPassword: { enabled: true, requireEmailVerification: false }` —
  there is no email infrastructure in this application at all today, and
  requiring it would defeat the point.

Token storage is `localStorage`, the same exposure profile as Firebase's
IndexedDB persistence. User-authored HTML is already run through
`sanitize-html` on write (`lib/utils-server.ts:clean`).

### Optional extras, all dark by default

| Env | Unlocks |
|---|---|
| `SMTP_URL`, `SMTP_FROM` | password reset |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Google sign-in |
| `GITHUB_CLIENT_ID` / `_SECRET` | GitHub sign-in |

Unset means the feature is hidden, never broken.

`BETTER_AUTH_SECRET` is **generated on first boot and persisted to the
database** when unset, so no operator has to run `openssl rand`. An explicit
env value always wins.

### Cleanup

`lib/firebase/admin.ts` exports `adminDatabase`, gated on `!isSelfHosted`,
imported by nothing. It is dead code, and it is the reason `SELFHOSTING.md`
tells operators to invent a plausible `FIREBASE_DATABASE_URL`. Both are
deleted.

## §4 — Storage port

`uploadImage` and `processImagesInHTML` currently run **in the browser**
(`components/app/{feedback-form,comment-form,settings/logo}`), uploading
straight to Supabase Storage with the public anon key. The port preserves
those call sites.

```ts
uploadImage(dataUrl: string): Promise<{ publicUrl: string }>
```

**`impl.supabase.ts`** — today's direct-to-Supabase upload, unchanged.
Keeping it matters: routing image bytes through a Vercel function would meet
the 4.5 MB request-body limit.

**`impl.postgres.ts`** — `POST /api/images` with an authenticated user, a
size cap, an extension allowlist and magic-byte validation via the
`image-size` call already in `processImagesInHTML`; bytes stored in an
`images` table; `GET /api/images/<id>` serves them with
`Cache-Control: public, max-age=31536000, immutable` and an ETag. Returned
URLs are **relative**, so an instance that changes domain does not orphan
every stored image.

This keeps the self-hosted container **completely stateless** — one
`DATABASE_URL` is the entire deployment, so it runs unchanged on Fly, Railway,
Render or Cloud Run, and one `pg_dump` is a complete backup. It also retires
the `"Allow anon uploads"` policy on `storage.objects` for self-hosters.

## §5 — Database migrations

This is the least glamorous section and the one most likely to bite.

**Today:** `db/schema.sql` is a Supabase dump. It references
`"extensions"."halfvec"` (Supabase installs pgvector into an `extensions`
schema), and its last two statements write to `storage.buckets` and
`storage.objects`, which do not exist on stock Postgres. `db/migrations/` holds
two `.sql` files that the guide instructs operators to paste into the Supabase
SQL editor by hand. `CREATE TYPE ... AS ENUM` in the base schema is not
idempotent.

**Target:** an ordered, tracked, idempotent migration set run by a Kysely
`Migrator`.

```
db/migrations/0001_init.sql        base schema, vanilla-Postgres clean
db/migrations/0002_insights.sql    existing file, renamed
db/migrations/0003_security.sql    existing file, renamed
db/migrations/0004_images.sql      §4 image storage
db/migrations/0005_auth.sql        Better Auth tables + instance secret
```

`0001_init.sql` opens with

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

so the **identical DDL runs on both stock Postgres and Supabase** — the
`extensions.halfvec` references in the existing schema keep working, and no
column type has to be rewritten. Enum creation is wrapped in a
`DO ... EXCEPTION WHEN duplicate_object` block. The Supabase storage
statements move out of the shared schema into a cloud-only file.

`scripts/migrate.ts` runs the migrator and is invoked by the container
entrypoint before `node server.js`. Migrations are tracked in a
`schema_migrations` table *and* written idempotently, so an existing database
that already has every object converges without hand-holding.

The hosted deployment does not auto-migrate — Vercel has no entrypoint — and
keeps running migrations deliberately, as it does now.

## §6 — AI becomes optional

Creating a post currently makes three LLM calls inline (moderation, title +
category, embedding) and **throws if any fail**. With no key,
`isInappropriateCheck` reaches `data?.choices?.[0]?.message?.content`,
finds nothing, returns `true`, and the post is rejected as inappropriate.
Search is purely vector-based, so with no embeddings it returns nothing at
all. A keyless instance is therefore not degraded today — it is broken.

**The capability flag is runtime** and surfaced to the client on the existing
`getOrg` payload. That query is already fetched globally by `useOrg`, so this
costs no extra round trip — and unlike a `NEXT_PUBLIC_` value it is correct
for a prebuilt image.

The flag is **not** simply `!!OPENROUTER_API_KEY`: a local model served by
Ollama or LM Studio needs no key at all, and keying off the API key alone
would hide AI on an instance that has it working. The condition is

```ts
hasLLM = !!process.env.OPENROUTER_API_KEY || !!process.env.LLM_BASE_URL
```

i.e. either a hosted provider's credential, or an explicitly configured
endpoint that may not need one.

| Surface | With a key | Without |
|---|---|---|
| Create post | moderation + AI title/category + embedding | title from first sentence (<=60 chars), category `general feedback`, no moderation, `embedding` null |
| Create comment | moderation + embedding | stored as written |
| Search | vector similarity | Postgres `ILIKE` over title + description, existing sort and cursor |
| Insights, AI roadmap, Ask-AI, "improve draft" | shown | hidden from nav and UI |

### Bring-your-own endpoint

`LLM_BASE_URL` (default `https://openrouter.ai/api/v1`) and `LLM_MODEL`
(default `google/gemini-3.8-flash`) make the four hard-coded OpenRouter URLs
in `lib/utils-server.ts`, `queries/create-feedback-post.ts`,
`trpc/rewrite-feedback.ts` and `app/api/chat/route.ts` configurable, so any
OpenAI-compatible endpoint works — Ollama, LM Studio, vLLM, or a different
hosted provider. `LLM_EMBEDDING_MODEL` likewise. An instance that sets these
to a local model has no external dependency at all.

The `reasoning` parameter is OpenRouter-specific and is omitted when
`LLM_BASE_URL` is overridden.

## §7 — Packaging and distribution

### Docker (primary)

`output: "standalone"`, a multi-stage `Dockerfile` (deps -> build -> runner),
`sharp` in the runner stage for image optimisation, non-root user, published
to `ghcr.io/feedbackland/feedbackland` by CI on tag.

`compose.yml`, the whole of it:

```yaml
services:
  db:
    image: pgvector/pgvector:pg18
    environment: [POSTGRES_PASSWORD=feedbackland, POSTGRES_DB=feedbackland]
    volumes: [db:/var/lib/postgresql/data]
    healthcheck: pg_isready
  app:
    image: ghcr.io/feedbackland/feedbackland:latest
    environment:
      DATABASE_URL: postgres://postgres:feedbackland@db:5432/feedbackland
    ports: ["3000:3000"]
    depends_on: { db: { condition: service_healthy } }
volumes: { db: }
```

No secrets to generate, no values to fill in, no repository to clone.

### TLS

The base compose serves HTTP on `localhost`, which is right for a first look
and wrong for production — **host sites are HTTPS, so an HTTP board in an
iframe is blocked as mixed content**. A documented `compose.tls.yml` override
adds Caddy with automatic Let's Encrypt, which needs one line: the domain.
This is prominent in the docs, not a footnote.

Optional `APP_URL` pins the public origin for deployments behind a proxy that
does not set `x-forwarded-proto` correctly.

### Vercel (secondary, supported)

The self-hosted profile is a normal Next.js app and runs on Vercel unchanged.
The docs keep a short Vercel path: fork, import, set `SELF_HOSTED=true` and
`DATABASE_URL`, run migrations once. What disappears is that Vercel is the
*only* path, and that `getVercelUrl()` is load-bearing — the widget snippet
and platform URL come from the tenancy port, which uses the request origin, so
`VERCEL_URL` is no longer consulted in this profile.

## §8 — First run

Self-hosted replaces the `/get-started` -> `/claim` wizard with a single setup
screen, reusing the `isClaimed` / `hasClaimedOrgQuery` machinery that already
exists for exactly this purpose.

1. Container boots, migrations run.
2. Any request with no claimed org redirects to `/setup`.
3. `/setup` asks four things: product name, your name, your email, a password.
4. Submitting creates the org (slug `default`), the auth user, the app `user`
   row, the `user_org` admin row, and marks the org claimed.
5. Redirect to `/`. The board is live and the operator is signed in as admin.
6. `/setup` afterwards redirects to `/`. In the cloud profile it 404s.

`setup` is added to `reservedSubdomains`. No conflict arises in the cloud
profile regardless: `acme.feedbackland.com/setup` is rewritten to
`/acme/setup`, which matches no route.

Settings that are meaningless with one tenant — the subdomain field in
`components/app/settings/platform-url.tsx`, the `orgSubdomain` branch of
`trpc/update-org.ts` — are hidden and server-side rejected in this profile.

## §9 — The widget needs no changes

`feedbackland-react` already accepts `url` and `platformId` together:
`resolvePlatformUrls` uses `url` for the board iframe and
`${origin}/api/feedback/create` for submissions, and `PopoverWidget` sends
`orgId: platformId`. A self-hosted snippet is therefore:

```tsx
<FeedbackButton
  url="https://feedback.example.com"
  platformId="<the default org's uuid>"
/>
```

which works against the published package as it stands. The admin Widget page
builds this from the tenancy port instead of `getVercelUrl()`. **No version of
the npm package is published as part of this work.**

## §10 — Documentation

`SELFHOSTING.md` is rewritten around the happy path:

```
Quick start            curl compose.yml && docker compose up  ->  create admin
Add your domain        + HTTPS via Caddy
Optional: AI features  one env var (or point at a local model)
Optional: social sign-in
Backups - Upgrades - Deploy on Vercel instead - Env reference - Troubleshooting
```

The quick start is the first screen and has no prerequisites beyond Docker.
Everything that is currently mandatory setup becomes an optional section.

## File impact

**New**

```
lib/tenancy/{types,index,impl.cloud,impl.selfhost}.ts
lib/auth/{types,server,client}.ts(x) + impl.{firebase,local}.{ts,tsx}
lib/storage/{types,index,impl.supabase,impl.postgres}.ts
lib/ai/capabilities.ts
app/setup/page.tsx + action
app/api/images/route.ts, app/api/images/[id]/route.ts
app/api/auth/[...all]/route.ts          (selfhost profile)
scripts/migrate.ts
db/migrations/000{1..5}_*.sql
Dockerfile, .dockerignore, compose.yml, compose.tls.yml
.github/workflows/publish-image.yml
```

**Modified**

`next.config.ts` (aliases, rewrites, redirects, standalone), `proxy.ts`
(cloud-only routing), `lib/trpc.ts`, `lib/utils.ts` (URL helpers move out),
`lib/utils-server.ts` (LLM base URL), `hooks/use-auth.tsx`,
`providers/trpc-client.tsx`, `queries/{create-feedback-post,create-comment,get-feedback-posts}.ts`,
`trpc/{get-org,update-org,rewrite-feedback}.ts`, `app/api/chat/route.ts`,
`components/app/{widget-docs,settings/platform-url,create-org-wizard}/*`,
`SELFHOSTING.md`, `README.md`, `.env.example`.

**Deleted**

`adminDatabase` from `lib/firebase/admin.ts`; `FIREBASE_DATABASE_URL`;
`hooks/use-vercel-url.ts` and `getVercelUrl()` from the self-hosted path.

## Risks

| Risk | Mitigation |
|---|---|
| Turbopack `resolveAlias` does not resolve `@/...` specifiers to relative files | Spike it before anything depends on it; codegen fallback described above |
| Moving cloud code behind ports regresses the hosted product | Cloud adapters are verbatim moves; both profiles must pass `tsc --noEmit` + `next build`; manual smoke of the hosted board before merge |
| `output: "standalone"` mis-traces `firebase-admin`, `pg` or `pgvector` | Build and boot the image early, in its own step, not at the end |
| Better Auth's bearer flow fails cross-origin inside the iframe | Explicitly test sign-in **from the embedded drawer on a different origin**, not only on the standalone board |
| Auto-generated `BETTER_AUTH_SECRET` in the database | Documented, env-overridable; sessions are DB rows and are invalidated with the secret |
| Images in Postgres bloat the database | Size cap per upload, documented; an S3 adapter is a future port implementation, not a rewrite |
| Keyless instances silently lose semantic search quality | `ILIKE` fallback is documented as a limitation in the AI section of the docs |

## Verification

1. `npm run typecheck` and `npx next build` clean in **both** profiles.
   (`npm run lint` is known broken on Next 16 and is not a gate.)
2. Hosted smoke: subdomain board loads, sign-in, post, comment, upvote,
   insights, admin pages, embedded drawer on a third-party origin.
3. Self-hosted smoke, from an empty volume: `docker compose up` -> `/setup` ->
   admin created -> post -> comment -> upvote -> search -> widget snippet
   embeds and submits from a different origin.
4. Keyless self-hosted: same flow with `OPENROUTER_API_KEY` unset; AI surfaces
   absent, everything else working.
5. Local-model self-hosted: `LLM_BASE_URL` pointed at Ollama; post creation
   produces an AI title.
6. Upgrade path: boot the new image against a database created by the old
   Supabase schema; migrations converge without manual steps.
