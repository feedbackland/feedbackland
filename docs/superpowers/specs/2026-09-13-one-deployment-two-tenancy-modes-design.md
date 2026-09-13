# One deployment, two tenancy modes

**Status:** approved design
**Date:** 2026-09-13
**Supersedes:** the two-build-profile design in this file's earlier revisions
(see git history). That design kept `feedbackland.com` on Firebase/Supabase/
Vercel and gave self-hosting a parallel implementation behind ports and
adapters. The mandate changed: there is to be **one version**, hostable either
as a multi-tenant platform or — the focus — as a dead-simple single-tenant
self-hosted instance, with vendor lock-in minimised everywhere.

## Problem

Feedbackland is currently one product with one deployment shape, and that
shape is welded to three vendors:

- **Firebase** is authentication. Its config is *committed to source*
  (`firebaseConfig.ts`), so self-hosting requires editing and committing code.
- **Supabase** is the database *and* the image store. Images upload straight
  from the browser with a public anon key.
- **Vercel** is assumed rather than chosen: no Dockerfile, `getIsSubdirOrg()`
  hard-codes `vercel.app`, `getVercelUrl()` reads `VERCEL_URL` to build the
  operator's own board URL.

`SELFHOSTING.md` is 22 KB and ~550 lines, requires four accounts and ten
environment values, and asks the operator to paste a SQL dump into a web
console. Meanwhile multi-tenancy — subdomains, an org wizard, a claim step —
is pure overhead for a self-hoster who wants one board.

## Goals

1. **One codebase, one artefact, one set of technologies.** No build profiles,
   no parallel implementations, no per-deployment forks.
2. **Multi-tenant hosting is easy**: `<tenant>.example.com`, wildcard DNS, TLS
   that provisions itself.
3. **Single-tenant self-hosting is trivial**, and is the flow everything else
   is optimised around: `docker compose up`, zero accounts, zero env values.
4. **Minimal lock-in.** The only hard dependency is a Postgres database.
5. Sign-in works inside the drawer widget's cross-origin iframe — **proven,
   not assumed** (§3).

## Non-goals

- Preserving existing `feedbackland.com` accounts. Confirmed as not needed:
  the instance has no user base worth migrating, so Firebase is deleted
  outright rather than migrated from. This removes an entire workstream.
- Migrating images already in Supabase Storage. Existing posts keep the
  Supabase URLs already baked into their HTML and keep working; only *new*
  uploads go to Postgres. The bucket stays alive until those posts age out.
- Changing the published `feedbackland-react` npm package (§9).
- Cross-tenant single sign-on on the hosted platform (§3, "Multi-tenant
  origins").
- Customer custom domains (`feedback.acme.com` → Acme's board). The chosen TLS
  approach makes this nearly free later; it is not built now.

## The shape of the answer

Two observations collapse most of the complexity.

**First: the app is already org-scoped.** Every query takes an `orgId`; every
tRPC procedure reads it from context. Multi-tenancy only decides *how `orgId`
is derived from a request*. So single-tenant is not a different product — it
is the same product with a constant resolution strategy. Multi-tenant support
therefore stays in the code permanently and costs almost nothing, which is
what lets a self-hoster run either mode.

**Second: with no requirement to keep prod on Firebase and Supabase, there is
nothing left to abstract.** The previous design needed ports and adapters only
to let two profiles diverge. One version needs one auth, one storage, one
everything — so the entire adapter layer disappears, and with it the riskiest
mechanism in the old plan (build-time bundler aliasing).

```
                   ┌──────────────────────────────────────┐
                   │  ghcr.io/feedbackland/feedbackland   │
                   │  Next.js (standalone) + Better Auth  │
                   └──────────────────┬───────────────────┘
                                      │  DATABASE_URL
                                      ▼
                        ┌────────────────────────────┐
                        │  Postgres + pgvector       │
                        │  data · users · sessions   │
                        │  images                    │
                        └────────────────────────────┘

   ROOT_DOMAIN unset          →  single tenant   (self-hoster default)
   ROOT_DOMAIN=example.com    →  multi tenant    (<tenant>.example.com)
```

**Tenancy is a runtime mode, not a build flag** — one image, both modes.

## §1 — Host-based tenant resolution

Today the tenant travels three ways at once: a path segment
(`app/[orgSubdomain]/`), a client-sent `subdomain` header, and a "subdir mode"
for localhost and `*.vercel.app`. All three collapse into one rule:

> The tenant is whatever the request's `Host` says it is. The client never
> tells the server which tenant it is.

```
ROOT_DOMAIN unset            → the single org (cached); Host ignored
ROOT_DOMAIN set:
  host == ROOT_DOMAIN/www    → no tenant  (signup)
  <label>.ROOT_DOMAIN:
      label reserved         → no tenant
      label is a uuid v4     → org by id
      otherwise              → org by orgSubdomain
```

Resolution is memoised per host with a short TTL and invalidated on org
update. `x-forwarded-host` is honoured only when the deployment declares it is
behind a trusted proxy.

This is also a security improvement: the `subdomain` header is currently
client-controlled input feeding the decision about *whose data* a request may
read. It ceases to exist.

Local multi-tenant development uses `acme.localhost:3000` — browsers resolve
`*.localhost` to loopback — which replaces subdir mode outright.

**Deleted by this section:** `getSubdomain`, `getMaindomain`,
`getIsSubdirOrg`, `navigateToSubdomain`, `getVercelUrl`, `useSubdomain`,
`useMaindomain`, `useVercelUrl`, the `subdomain` request header, and
`app/api/org/[orgId]/route.ts` with the UUID-subdomain redirect dance in
`proxy.ts` that depends on it.

## §2 — Routing

`app/[orgSubdomain]/(board)/…` becomes `app/(board)/…`. Because the tenant
lives in the hostname, **the URLs are identical in both modes**:

| | multi-tenant | single-tenant |
|---|---|---|
| board | `acme.example.com/` | `feedback.acme.com/` |
| post | `acme.example.com/<postId>` | `feedback.acme.com/<postId>` |
| admin | `acme.example.com/admin` | `feedback.acme.com/admin` |

Wherever a tenant resolves, `/` is the board. The one case where it is not is
the root domain in multi-tenant mode, where no tenant resolves and `/`
redirects to `/signup`. `/signup` and `/setup` live outside the `(board)`
route group so the board chrome does not wrap them. Keeping a single `/` route
that branches on the resolved tenant avoids the "two route trees both claiming
`/`" conflict that a separate marketing group would create — that is a hard
Next.js build error, not a preference.

`[postId]` is now a root-level dynamic segment, so it is guarded to UUIDs —
anything else 404s rather than attempting a post lookup. Static segments
(`admin`, `signup`, `setup`, `api`) take precedence in Next's matcher, and the
same names stay in `reservedSubdomains` so no tenant can claim them.

**No middleware is required for tenancy.** This matters:
[vercel/next.js#86122](https://github.com/vercel/next.js/issues/86122) reports
`proxy.ts` silently not executing under `output: "standalone"` behind some
reverse proxies. Correctness must not depend on it. `proxy.ts` is reduced to
one job — setting the `?embed=drawer` header so the embedded board's first
paint is correct — which degrades to a single frame of flash if it never runs.

Cost: pages that read `Host` are dynamically rendered. Two currently-static
routes lose static rendering. Accepted.

## §3 — Auth

**Better Auth everywhere.** Firebase is deleted, not abstracted.

```
server:  auth.api.getSession({ headers })  →  { user: { id, email } }
client:  signUp/signIn/signOut/getSession + signIn.popup (social)
```

`public.user.id` is `text` and currently holds a Firebase uid, so Better
Auth's user id drops in with **no schema change**. The existing `upsertUser`
mirror flow — which already runs on every sign-in — keeps `public.user`,
`user_org` and roles as the app's own source of truth.

### Cookies are impossible in the drawer — measured

The drawer renders the board in an iframe on a customer's domain, and sign-in
is reachable there: `sign-up-in/dialog.tsx` opens from `upvote-button`,
`comment-form` and `feedback-form`. A two-site harness probed a cross-site
frame in Chrome at default settings:

| Probe | Result |
|---|---|
| `document.cookie`, `SameSite=Lax` | **BLOCKED** — cannot be set |
| `document.cookie`, `SameSite=None` | **BLOCKED** |
| `navigator.cookieEnabled` | `true` — reports the opposite of the truth |
| `localStorage` / `sessionStorage` / `indexedDB` | work |

Storage is **partitioned per embedding site** (the same board framed by a
different top-level site saw none of the first site's data) but **persists
within a partition** (returning to the first site read the original value
back). So cookie sessions in the drawer are not degraded — they are
impossible, and `navigator.cookieEnabled` actively lies about it.

Bearer-token-in-`Authorization` is therefore mandatory. CSRF is not the
problem people expect: the iframe document is served *from* the board's
origin, so its own `fetch` calls are same-origin.

### Proven end-to-end, both sign-in paths

Storage primitives working is a weaker claim than *Better Auth* working, so
the real stack was run under the real embedding conditions — better-auth
**1.7.4**, a real browser, and the board framed by a different site using
**the exact `sandbox` attribute the shipped widget sets**
(`allow-scripts allow-same-origin allow-forms allow-popups
allow-popups-to-escape-sandbox`). `allow-same-origin` is what preserves the
frame's origin and therefore its storage; it is load-bearing for auth, not
incidental.

**Email + password**

| # | Check, inside the cross-site sandboxed frame | Result |
|---|---|---|
| 1 | `signUp.email` | succeeds, `set-auth-token` returned |
| 2 | Protected endpoint via `auth.api.getSession({ headers })` | **200** |
| 3 | Reload host page | session restored from the token store |
| 4 | `authClient.getSession()` after reload | returns the user, **bearer only** |
| 5 | **Clear the token**, retry 2 and 4 | `null` and **401** |
| 6 | `signIn` → 200 → `signOut` → 401 | passes |
| 7 | `localStorage` forced to throw `SecurityError` | memory fallback; sign-in still works |

**Check 5 is the one that removes all doubt.** Better Auth's session cookie is
`HttpOnly`, so an empty `document.cookie` proves nothing — JavaScript cannot
see an HttpOnly cookie, and the whole suite could have been passing on one.
Destroying the token and watching the session die with it is what proves the
bearer token carries the session and nothing else does.

**Social sign-in (Google/Microsoft in prod)**

OAuth cannot redirect inside the frame — providers send `X-Frame-Options:
DENY` — so it must use a popup. Better Auth 1.7.4 ships a purpose-built
`oauthPopup` / `oauthPopupClient` plugin pair for precisely this, documented
as attaching "the popup token as a bearer header **when embedded (where the
cookie is partitioned)**". It runs OAuth in the popup's own first-party
context, then posts the session token back to the opener.

This was tested against a genuinely cross-site identity provider (a minimal
authorization-code server on a third site, standing in for Google) with a real
user gesture:

| # | Check | Result |
|---|---|---|
| 8 | `signIn.popup` from inside the frame | `success: true` |
| 9 | Protected endpoint with the popup token | **200**, correct user |
| 10 | Reload | session persists |
| 11 | **Clear the token** | **401** — again, no hidden cookie |
| 12 | `localStorage` throws | plugin returns `POPUP_SIGN_IN_FAILED` |

**Check 12 is a real, measured limitation and it has a proven fix.** The
plugin persists its token to `localStorage` and gives up if that throws. But
the completion page's handoff is a `postMessage` with a documented, exported
contract (`better-auth:oauth-popup`, gated on origin and nonce), and every
listener receives that event. Adding our own listener that captures the token
into a memory-backed store was tested under the same forced-throw conditions:
the plugin still reported `POPUP_SIGN_IN_FAILED`, **our fallback carried the
session and the protected call returned 200**. Roughly fifteen lines, on a
supported extension point.

So the app's token store — not the plugin's — is the source of truth, and it
degrades `localStorage → memory`. In the memory case a session lasts the
lifetime of the iframe document, which is the correct worst case.

### Accepted consequences

- A drawer session on `customer-a.com` is separate from one on
  `customer-b.com` and from the standalone board. That is storage
  partitioning, and Firebase's IndexedDB behaves identically today.
- Bearer tokens in `localStorage` have the same XSS exposure as Firebase's
  IndexedDB persistence. User HTML is already sanitised on write
  (`lib/utils-server.ts:clean`).

### Limits of the evidence

The spike ran on SQLite, not Postgres — the database sits behind Better Auth's
adapter layer and is not involved in any cookie/bearer/iframe semantics, but
the Postgres build is still smoke-tested during implementation. It ran on
Chrome over HTTP; production is HTTPS, which changes nothing here *because* no
cookie is involved. Firefox and Safari were not driven directly — checks 7 and
12 are what stand in for Safari's stricter behaviour, and both pass.

### Multi-tenant origins

Each tenant board is its own origin, and Better Auth has first-class support
for that rather than a single fixed `baseURL`:

```ts
baseURL: {
  allowedHosts: [ROOT_DOMAIN, `*.${ROOT_DOMAIN}`],   // wildcard matching
  fallback: `https://${ROOT_DOMAIN}`,
  protocol: "https",
},
trustedOrigins: [`https://${ROOT_DOMAIN}`, `https://*.${ROOT_DOMAIN}`],
advanced: { trustedProxyHeaders: true },   // behind Caddy
```

`trustedProxyHeaders` is what makes `x-forwarded-host` authoritative behind
the reverse proxy; without it every tenant resolves to the proxy's own host.
Bearer tokens are stored per-origin, so a session is naturally scoped to one
tenant — which is correct isolation, and the reason cross-tenant SSO is a
non-goal.

In single-tenant mode `APP_URL` pins the origin when set; unset, it is
inferred from the request, which is what makes a zero-config `docker compose
up` work on `localhost`.

### Optional, dark by default

`SMTP_URL`/`SMTP_FROM` unlock password reset; `GOOGLE_CLIENT_ID`/`_SECRET` and
`MICROSOFT_*` unlock social sign-in. Unset means hidden, never broken — there
is no email infrastructure in the app today and requiring one would defeat the
point. `BETTER_AUTH_SECRET` is generated and persisted on first boot when
unset, so nobody has to run `openssl rand`.

## §4 — Image storage

Uploads move server-side: `POST /api/images` (authenticated, size-capped,
extension allowlist, magic-byte validation via the `image-size` call already
in `processImagesInHTML`), bytes in Postgres, served by
`GET /api/images/<id>` with `Cache-Control: immutable` and an ETag. Returned
URLs are relative, so changing domain does not orphan stored images.

This keeps the container **stateless** — one `DATABASE_URL` is the whole
deployment, so it runs unchanged on Fly, Railway, Render or Cloud Run, and one
`pg_dump` is a complete backup. It also retires the browser-held anon key and
the public `storage.objects` insert policy.

An S3-compatible option is a later addition for anyone who outgrows Postgres;
it is not needed for correctness and is not built now. Existing Supabase image
URLs in old posts keep resolving untouched (non-goal above).

## §5 — Schema and migrations

`db/schema.sql` is a Supabase dump: it references `"extensions"."halfvec"`
(Supabase installs pgvector into an `extensions` schema) and its last two
statements write to `storage.buckets` / `storage.objects`, which do not exist
on stock Postgres. The two files in `db/migrations/` are hand-pasted SQL, and
`CREATE TYPE … AS ENUM` is not idempotent.

Target: an ordered, tracked, idempotent set run by a Kysely `Migrator`.

```
0001_init.sql        base schema, vanilla-Postgres clean
0002_insights.sql    existing file, renamed
0003_security.sql    existing file, renamed
0004_images.sql      §4
0005_auth.sql        Better Auth tables + instance secret
```

`0001_init.sql` opens with

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

so the **same DDL runs on stock Postgres and on Supabase** — the existing
`extensions.halfvec` column types need no rewriting. Enum creation is wrapped
in a `DO … EXCEPTION WHEN duplicate_object` block; the Supabase storage
statements move to a cloud-only file.

`scripts/migrate.ts` runs before the server starts. Better Auth's own tables
are created by `getMigrations(auth.options).runMigrations()`, which the spike
**verified works programmatically at boot and is idempotent across restarts**.

## §6 — AI is optional

Creating a post makes three LLM calls inline and throws if any fail: with no
key, `isInappropriateCheck` finds no content in the response, returns `true`,
and the post is rejected as inappropriate. Search is purely vector-based, so
with no embeddings it returns nothing. A keyless instance today is not
degraded — it is broken.

The capability flag is **runtime**, surfaced on the existing `getOrg` payload
(already fetched globally by `useOrg`, so no extra round trip). It is not
simply `!!OPENROUTER_API_KEY` — a local model needs no key:

```ts
hasLLM = !!process.env.OPENROUTER_API_KEY || !!process.env.LLM_BASE_URL
```

| Surface | With | Without |
|---|---|---|
| Create post | moderation + AI title/category + embedding | title from first sentence, category `general feedback`, no moderation, `embedding` null |
| Create comment | moderation + embedding | stored as written |
| Search | vector similarity | Postgres `ILIKE` over title + description |
| Insights, AI roadmap, Ask-AI, "improve draft" | shown | hidden |

`LLM_BASE_URL`, `LLM_MODEL` and `LLM_EMBEDDING_MODEL` make the four hard-coded
OpenRouter URLs configurable, so Ollama, LM Studio or vLLM work and an
instance can have no external dependency at all. The OpenRouter-specific
`reasoning` parameter is omitted when the base URL is overridden.

## §7 — Packaging

One image, `output: "standalone"`, multi-stage build, `sharp` in the runner,
non-root, published to GHCR by CI on tag. Three recipes, same image:

**1 — Self-host, single tenant.** The documented default.

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

No secrets to generate, nothing to fill in, no repository to clone.

**2 — Self-host with a domain.** Adds Caddy; set `DOMAIN`. TLS is automatic.
This is not optional in practice: host pages are HTTPS, so an HTTP board in an
iframe is blocked as mixed content. It is documented prominently, not as a
footnote.

**3 — Multi-tenant platform.** Set `ROOT_DOMAIN`, point wildcard DNS at the
host, and let Caddy issue **per-tenant certificates on demand**:

```
:443 {
  tls { on_demand }
}
```

with `ask` pointed at an app endpoint that confirms the tenant exists, plus
Caddy's issuance rate limits as the backstop. This is the standard multi-tenant
SaaS pattern and it deliberately avoids the usual lock-in: **no wildcard
certificate and no DNS-provider API token.** The same `ask` endpoint is what
would later make customer custom domains nearly free.

**Vercel** still works — it is a plain Next.js app — and stays documented as an
alternative, but nothing depends on it.

## §8 — First run

**Single tenant.** No claimed org → `/setup` → one form (product name, your
name, email, password) → creates the org, the auth user, the `user` row, the
admin `user_org` row, and claims it → redirect to `/`, signed in. Afterwards
`/setup` redirects to `/`.

**Multi tenant.** Root domain `/` → `/signup` → same underlying "create org +
first admin" path → redirect to `<slug>.<ROOT_DOMAIN>`.

Both reuse one code path; the existing `isClaimed` / `hasClaimedOrgQuery`
machinery already models this. The subdomain field in settings and the
`orgSubdomain` branch of `trpc/update-org.ts` are hidden and server-side
rejected in single-tenant mode.

## §9 — The widget needs no changes

`feedbackland-react` already accepts `url` and `platformId` together:
`resolvePlatformUrls` uses `url` for the iframe and
`${origin}/api/feedback/create` for submissions, and `PopoverWidget` sends
`orgId: platformId`. A self-hosted snippet is therefore

```tsx
<FeedbackButton url="https://feedback.example.com" platformId="<org uuid>" />
```

against the package as published. `/api/feedback/create` resolves the org from
`Host` and **falls back to the body's `orgId`**, which is what keeps the
`api.feedbackland.com` entry point (where the host carries no tenant) working.
No npm release is part of this work.

## §10 — Documentation

`SELFHOSTING.md` is rewritten around the happy path — `curl` a compose file,
`docker compose up`, create an admin — with everything currently mandatory
demoted to optional sections: domain + HTTPS, AI, social sign-in, backups,
upgrades, running multi-tenant, deploying on Vercel instead, env reference,
troubleshooting. The quick start is the first screen and needs only Docker.

## What this deletes

The point of the redesign is subtraction:

- Firebase entirely — SDKs, `firebaseConfig.ts`, admin credentials,
  `FIREBASE_DATABASE_URL`, and the dead `adminDatabase` export
- `@supabase/supabase-js` and the browser-held anon key
- Build profiles, and the bundler-aliasing mechanism that was the riskiest
  part of the previous design
- The auth/storage/tenancy adapter pairs — one implementation each now
- Subdir mode, the `subdomain` header, `app/[orgSubdomain]/`,
  `app/api/org/[orgId]`, and tenant routing in `proxy.ts`
- `getVercelUrl`, `useVercelUrl`, `getIsSubdirOrg`, `getMaindomain`,
  `getSubdomain`, `useSubdomain`, `useMaindomain`
- The Firebase→Better Auth user migration (confirmed unnecessary)

## Risks

| Risk | Mitigation |
|---|---|
| Auth fails in the drawer's cross-origin iframe | **Retired.** Both paths proven end-to-end against better-auth 1.7.4 under the widget's exact sandbox, including the no-hidden-cookie check (§3) |
| Popup OAuth breaks where `localStorage` throws | **Measured and fixed.** Own completion-message listener + memory store, verified under forced-throw (§3, check 12) |
| The widget's `sandbox` loses `allow-same-origin` in a later change, silently killing auth | Recorded as load-bearing in `OverlayWidget.tsx` and asserted by acceptance test 3 |
| Moving to host-based tenancy breaks an unnoticed caller of the old helpers | The helpers are **deleted**, not deprecated, so every caller is a compile error rather than a silent fallback |
| `trustedProxyHeaders` misconfigured behind Caddy → every tenant resolves to the proxy host | Multi-tenant acceptance test runs behind the real Caddy config, not just directly |
| Host-header injection influencing auth URLs | Bounded by `baseURL.allowedHosts`; `APP_URL` recommended for single-tenant behind a proxy |
| `output: "standalone"` mis-traces `pg` / `sharp` / `pgvector` | Build and boot the image in its own early step, not at the end |
| Images in Postgres bloat the database | Per-upload size cap, documented; S3 remains an additive option |
| Everything becomes dynamically rendered | Accepted; two static routes affected, both already client-fetching |

## Verification

1. `npm run typecheck` and `npx next build` clean. (`npm run lint` is known
   broken on Next 16 and is not a gate.)
2. **Single-tenant smoke, from an empty volume** — the primary flow:
   `docker compose up` → `/setup` → post → comment → upvote → search → admin
   → widget snippet embeds and submits from another origin.
3. **Drawer auth acceptance test — merge blocker.** Serve a page on a
   different site embedding the real widget, and entirely inside the drawer:
   sign up, sign out, sign in; upvote and comment; reload and remain signed
   in; sign in with a social provider via popup; then repeat with cookies
   blocked for the board origin, and again with `localStorage` forced to
   throw. Chrome and Firefox at minimum. The spike harness is the template.
4. **Multi-tenant smoke**: `ROOT_DOMAIN` set, two tenants, behind the real
   Caddy config — each resolves its own board, per-tenant certificates issue
   on demand, the `ask` endpoint rejects unknown hosts, and a session on one
   tenant is not a session on the other.
5. **Keyless**: everything in 2 with no LLM configured; AI surfaces absent,
   posting and search still working.
6. **Local model**: `LLM_BASE_URL` at Ollama; post creation produces an AI
   title.
7. **Upgrade**: boot against a database created by the old Supabase schema;
   migrations converge with no manual steps, and old Supabase image URLs in
   existing posts still resolve.
