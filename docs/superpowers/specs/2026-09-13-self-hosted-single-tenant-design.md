# Feedbackland: self-hosted, single-tenant, vendor-agnostic

**Status:** approved design · rewritten after the scope reset
**Date:** 2026-09-13
**Supersedes:** every earlier revision of this file, which designed a product
that was multi-tenant on Vercel *and* self-hostable. See git history.

Feedbackland becomes **one thing**: a feedback board you run yourself, for one
product, on infrastructure you choose. There is no hosted service, no
`feedbackland.com` deployment, no tenants, and no backward compatibility to
preserve. Authentication is Better Auth. The only hard dependency is a Postgres
database with pgvector.

Above all it must be **ridiculously easy to get running** — one click, or one
`docker compose up`.

## Goals

1. **Self-hosted only. Single-tenant only.** One instance, one board, one
   product. Not "multi-tenancy turned off" — multi-tenancy does not exist.
2. **As little vendor lock-in as possible.** Postgres + pgvector is the whole
   requirement. Everything else is optional or swappable.
3. **Extremely easy to start**, for someone who has never used Docker: a deploy
   button, or a single compose file.
4. **Firebase and Supabase are gone** from the codebase. Better Auth handles
   identity; Postgres holds everything including images.
5. **AI is genuinely optional and clearly recommended**, with the trust story
   spelled out (§5).

## Non-goals

- Multi-tenancy, subdomains, org switching, or a signup funnel, in any form.
- A hosted `feedbackland.com` service, or anything that assumes one exists.
- Backward compatibility, data migration, or preserving existing accounts.
- An S3 storage backend. Postgres is the image store; S3 stays additive.

## What this reset deletes

Most of the previous design existed to serve a hosted multi-tenant product.
All of it goes:

| Gone | Why |
|---|---|
| Host-based tenant resolution, `MULTI_TENANT_ROOT_DOMAIN`, `reservedSubdomains` | No tenants |
| The `<uuid>` → slug redirect, `/signup` | No tenants |
| `oAuthProxy`, `baseURL.allowedHosts` wildcards | One origin, one OAuth redirect URI |
| `/api/tls-check`, Caddy on-demand TLS | No per-tenant certificates |
| Vercel recipes, `BUILD_TARGET`, the `VERCEL_ENV` migration guard, `maxDuration` | Nothing deploys to Vercel |
| Supabase as *our* database, pooled/direct split as a production concern | Not our infrastructure |
| The `demo.feedbackland.com` auto-login and `DEMO_*` | No hosted demo to sign into |
| Firebase, and the entire account-migration workstream | Deleted outright, clean slate |
| **The `org` concept itself** | See §1 |

`output: "standalone"` becomes unconditional, the build command carries no
platform-specific flag, and the deploy story is Docker plus a one-click
template.

## §1 — Removing the org concept

The codebase is built around organisations. Counted across `lib/`, `app/`,
`components/`, `hooks/`, `queries/`, `trpc/` and `db/`:

| Identifier | Occurrences |
|---|---|
| `orgId` | **323** |
| `platformUrl` / `usePlatformUrl` / `getPlatformUrl` | **111** |
| `orgSubdomain` | 81 |
| `user_org` | 45 |
| `orgName` / `orgUrl` / `isClaimed` | 74 |
| `useOrg` / `getOrg` / `updateOrg` / `createOrg` / `claimOrg` | 54 |

In a product with exactly one board this is all ceremony — and worse, it is
*misleading* ceremony, because anyone reading the code concludes the product is
multi-tenant.

There is no data to migrate, so this is a compile-time change rather than a
runtime risk. It is removed properly:

**The `org` table becomes what it actually is.** Stripped of `orgSubdomain`
(no subdomains) it holds `platformTitle`, `platformDescription`, `logo`,
`orgName`, `orgUrl` — these are **instance settings**, not tenant properties,
and a single-tenant product genuinely needs them. It survives as a one-row
`settings` table, with the first-run claim flag (§7) alongside.

**`user_org` collapses into `user.role`.** A join table addressing a single
organisation is pure overhead; `role` (`admin` | `user`) becomes a column on
`user`, which is what every reader expects and what `adminProcedure` actually
wants.

**`orgId` disappears** from `feedback`, `insights`, `insight_reports`,
`admin_invites` and their indexes, and from every query, procedure and
component that threads it through.

This also dissolves a class of bug rather than fixing it. Four queries
(`getFeedbackPostQuery`, `getCommentQuery`, `upvoteFeedbackPostQuery`,
`upvoteCommentQuery`) fetch or mutate by primary key with no tenant predicate —
a cross-tenant read and write hole in a multi-tenant product. With one board
there is nothing to cross, and with `orgId` gone there is no predicate to
forget.

`lib/trpc.ts` simplifies with it: `publicProcedure` no longer guards on an org,
`userProcedure` needs a verified user, and `adminProcedure` reads `user.role`.

### `platformUrl` goes too

The second-largest cluster, and one an earlier draft of this section missed
entirely. `getPlatformUrl()` exists because a board could live at
`https://acme.feedbackland.com` **or** at `host/acme` in subdir mode, so every
internal link was built absolutely: `` `${platformUrl}/admin` ``. With one board
at the root of a hostname, that is 111 occurrences computing a prefix that is
always the current origin.

They become **relative links** — `/admin`, `/`, `/${postId}` — and
`getPlatformUrl`, `usePlatformUrl` and `hooks/use-platform-url.ts` are deleted
with the rest.

Three places genuinely need an absolute URL and keep one, derived from
`APP_URL` or the request origin rather than from a tenancy helper: the **admin
invite link** (`createAdminInvite` returns a copyable URL), the **widget
snippet** on the admin Widget page, and the **API examples** in
`lib/api-snippets.ts`. Naming them here matters because "delete
`getPlatformUrl`" applied blindly would quietly turn a copyable invite link
into a relative path that is useless in an email.

### One limit must survive the removal

`lib/rate-limit.ts` keys its caps per IP *and* per org —
`feedback-create:org:${orgId}` — and the comment in the file is explicit that
the org-level cap, not the IP one, is "the real cost cap": it is what stops a
leaked endpoint running up an unbounded model bill.

Deleting `orgId` naively turns that key into a constant and it would be easy to
drop it as meaningless. It is not. It becomes an **instance-wide** cap with the
same purpose, and it is the only thing standing between a public endpoint and
someone else's API credit.

## §2 — Routing

`app/[orgSubdomain]/(board)/…` becomes `app/(board)/…`, served at the root of a
hostname. No dynamic tenant segment, no rewrite, no sentinel path, and **no
middleware required** — which matters because
[vercel/next.js#86122](https://github.com/vercel/next.js/issues/86122) reports
`proxy.ts` silently not executing under `output: "standalone"` behind some
reverse proxies.

`proxy.ts` is reduced to one job: setting the `?embed=drawer` header so the
embedded board's first paint is correct. If it never runs, `EmbedProvider`
resolves on the client and the drawer flashes once instead of breaking.

**Routes removed:** `app/get-started/`, `app/[orgSubdomain]/claim/`, the claim
step of `create-org-wizard`, and the empty `app/design-preview/`.

**The board must be served at the root of a hostname**, not under a path.
`https://feedback.acme.com` works; `https://acme.com/feedback` does not. Next's
`basePath` would move the API routes with it, and the widget computes its
submission endpoint at the origin root — so a `basePath` deployment would POST
feedback to a path that does not exist. Stated as a constraint and documented
beside the domain step.

### Framing policy

The app sets **no security headers at all** today. Every route is embeddable by
any site, which is *required* for the board — the drawer widget's whole purpose
— and wrong for everything else. `/admin` framed by an arbitrary origin is a
clickjacking target for a signed-in admin.

Per route, in `next.config.ts` `headers()`:

| Routes | `Content-Security-Policy` |
|---|---|
| board (`/`, `/<postId>`) | `frame-ancestors *` — embedding is the product |
| `/admin/*`, `/setup`, `/api/auth/*` | `frame-ancestors 'none'` |

A stricter full CSP is deliberately not attempted: the root layout ships an
inline boot script that must run before first paint, and Better Auth's popup
completion page ships its own (the package exports
`OAUTH_POPUP_SCRIPT_CSP_HASH` for exactly that). Getting either wrong breaks
first paint or sign-in. Framing is the risk that applies here; the rest is
separate, testable work.

### Dead code that looks load-bearing

Three paths read as live infrastructure and are not. Each is deleted, and
listed so nobody preserves them for nothing:

- **`lib/firebase/admin.ts: adminDatabase`** — a Realtime Database handle
  imported by nothing, and the sole reason `FIREBASE_DATABASE_URL` is a
  documented required variable.
- **`hooks/use-sse.ts`** — nothing constructs an `EventSource`. Worth recording
  why it must not return: `EventSource` cannot send an `Authorization` header,
  so any future SSE endpoint would need a cookie this architecture deliberately
  does not have. Streaming goes over `fetch`, as Ask-AI already does.
- **`providers/iframe.tsx` + `iframeParentAtom`** — a penpal RPC channel with
  `allowedOrigins: ["*"]`, never mounted. Easy to mistake for the widget's
  protocol; the real one is the `postMessage` readiness handshake in the root
  layout and `platform-ready-signal`.

## §3 — Auth

**Better Auth.** Firebase is deleted, not abstracted. With a clean slate there
is no legacy hash format and no custom password verification: Better Auth's own
scrypt hashes every password from the first signup.

```
server:  auth.api.getSession({ headers })  →  { user: { id, email } }
client:  signUp / signIn / signOut / getSession + signIn.popup (social)
```

### Table ownership — verified

Better Auth creates a table literally named **`user`**, colliding with the
application's own (which several foreign keys reference). Its models are
renamed:

```ts
user:         { modelName: "auth_user" },
session:      { modelName: "auth_session" },
account:      { modelName: "auth_account" },
verification: { modelName: "auth_verification" },
```

Verified against a database pre-loaded with the app's real `user` table:
`getMigrations` reported `toBeCreated: auth_user, auth_session, auth_account,
auth_verification` and `toBeAdded: (none)`; the app's columns and rows were
untouched, and a real sign-up wrote one `auth_user` row while `public.user`
stayed at its original count.

Identity lives in `auth_*`; the app's `user` row (name, photo, **role**) is
populated on sign-in by an authenticated `ensureSession` mutation with
`user.id` set to the Better Auth user id. `public.user.id` is already `text`,
so no column type changes.

Letting Better Auth own `public.user` outright was considered and rejected: it
would put a library's migrations in charge of a table the application's foreign
keys depend on, to remove one upsert that has to run anyway.

**Known cost, accepted:** `auth.api.getSession` reads the session row, so every
authenticated request costs one indexed lookup — once per tRPC *batch*, not per
procedure, since the client uses `httpBatchLink`. Better Auth's `jwt` plugin
restores stateless verification later without changing a call site.

### Cookies are impossible in the drawer — measured

The drawer renders the board in an iframe on a customer's domain, and sign-in
is reachable there (`sign-up-in/dialog.tsx` opens from `upvote-button`,
`comment-form`, `feedback-form`). A two-site harness probed a cross-site frame
in Chrome at default settings:

| Probe | Result |
|---|---|
| `document.cookie`, `SameSite=Lax` | **BLOCKED** — cannot be set |
| `document.cookie`, `SameSite=None` | **BLOCKED** |
| `navigator.cookieEnabled` | `true` — the opposite of the truth |
| `localStorage` / `sessionStorage` / `indexedDB` | work |

Storage is partitioned per embedding site but persists within a partition.
Cookie sessions in the drawer are not degraded — they are impossible, and
`navigator.cookieEnabled` actively lies about it.

Bearer-token-in-`Authorization` is therefore mandatory. CSRF is not the problem
people expect: the iframe document is served *from* the board's origin, so its
own `fetch` calls are same-origin.

### Proven end-to-end, both sign-in paths

better-auth **1.7.4**, a real browser, the board framed by a different site
using **the widget's exact `sandbox` attribute**. `allow-same-origin` preserves
the frame's origin and therefore its storage: load-bearing for auth, and
recorded as such in `OverlayWidget.tsx`.

**Email + password**

| # | Check, inside the cross-site sandboxed frame | Result |
|---|---|---|
| 1 | `signUp.email` | succeeds, `set-auth-token` returned |
| 2 | Protected endpoint via `auth.api.getSession({ headers })` | **200** |
| 3 | Reload host page | session restored |
| 4 | `authClient.getSession()` after reload | user returned, **bearer only** |
| 5 | **Clear the token**, retry 2 and 4 | `null` and **401** |
| 6 | `signIn` → 200 → `signOut` → 401 | passes |
| 7 | `localStorage` forced to throw | memory fallback; sign-in works |

**Check 5 is what removes all doubt.** Better Auth's session cookie is
`HttpOnly`, so an empty `document.cookie` proves nothing — the suite could have
been passing on a cookie JavaScript cannot see. Destroying the token and
watching the session die with it proves the bearer token carries it.

**Social sign-in**

OAuth cannot redirect inside the frame (providers send `X-Frame-Options: DENY`),
so it uses a popup. Better Auth ships `oauthPopup` / `oauthPopupClient` for
precisely this, documented as attaching "the popup token as a bearer header
when embedded (where the cookie is partitioned)". Tested against a genuinely
cross-site identity provider with a real user gesture:

| # | Check | Result |
|---|---|---|
| 8 | `signIn.popup` from inside the frame | `success: true` |
| 9 | Protected endpoint with the popup token | **200** |
| 10 | Reload | session persists |
| 11 | **Clear the token** | **401** — again, no hidden cookie |
| 12 | `localStorage` throws | plugin returns `POPUP_SIGN_IN_FAILED` |

**Check 12 is a measured limitation with a proven fix.** The plugin persists
its token to `localStorage` and gives up if that throws. But the completion
handoff is a `postMessage` on a documented, exported contract
(`better-auth:oauth-popup`, gated on origin and nonce) and every listener
receives it. Our own listener capturing the token into a memory-backed store
was tested under the same forced-throw conditions: the plugin still reported
failure, **our fallback carried the session and the protected call returned
200**. The app's token store is the source of truth, degrading
`localStorage → memory`.

**Single origin makes this simpler than it was.** With no tenant subdomains
there is one OAuth redirect URI, so `oAuthProxy` is not needed at all — the
relay it exists to perform has nowhere to relay to. Google and Microsoft are
both built-in Better Auth providers; Microsoft takes an Entra tenant id
(`MICROSOFT_TENANT_ID`, default `common`).

### Account linking — deliberately off

`requireEmailVerification` is `false` (no mandatory email infrastructure),
which makes automatic linking-by-email an **account-takeover vector**: someone
could register a password account on an address they do not own, and
auto-linking would hand them the real owner's account when that owner later
signs in with Google.

Linking is therefore disabled. A second method on an existing email is refused
with "this email is already registered — sign in with your existing method,
then connect Google from account settings", and linking is only possible from
an authenticated session.

### Password reset

There is no email infrastructure, and requiring one would defeat a zero-config
self-host. Three tiers, so **no deployment is without a reset path and none
requires SMTP**:

1. **`SMTP_URL` configured** → ordinary self-service email reset.
2. **No SMTP** → an admin generates a one-time reset link from the Admins page
   and delivers it however they like — reusing the app's existing idiom, since
   `createAdminInvite` already returns a copyable link instead of sending mail.
3. **Locked out entirely** → `docker compose exec app node scripts/reset-password.mjs <email>`
   prints a one-time link.

Tiers 2 and 3 need no separate machinery: Better Auth's `requestPasswordReset`
hands the URL to a `sendResetPassword` callback, so with no SMTP that callback
returns the URL instead of mailing it. One code path, one token lifetime.

Password policy is Better Auth's default minimum of 8 characters, stated so it
is a decision rather than an accident.

### Brute-force protection, and the proxy trap

Better Auth's rate limiting defaults to **production-only** and
**`storage: "memory"`**, keyed on client IP. Two consequences:

- Memory storage is lost on restart and unshared between instances, so limits
  are weaker than they appear. `storage: "database"` uses the Postgres we
  already require.
- **The proxy trap:** behind a reverse proxy every request arrives from the
  proxy unless `advanced.ipAddress.headers` is configured, so auth rate
  limiting would key *every user to one bucket* — one attacker brute-forcing
  one account locks out sign-in for everyone. A security control that becomes a
  denial of service.

So `rateLimit: { enabled: true, storage: "database" }` always, and
`advanced.ipAddress.headers` set to `["x-forwarded-for"]` **only when
`TRUST_PROXY=true`** — trusting that header with no proxy in front lets a
client spoof past the limit. The same flag governs `getClientIp` for the app's
own limits, so there is one switch.

### Sessions, sign-out, and server actions

Sessions are 30 days with a rolling `updateAge`. Because tokens are bearer,
**sign-out clears the app's own token store as well as Better Auth's** — the
popup plugin only clears the key it owns, and a token left behind would keep
authenticating tRPC calls after an apparent sign-out. An explicit test case.

`ensureSession` runs immediately after sign-in and is authenticated, so the
token must be captured *before* it is called: capture → store → `ensureSession`
→ session state.

**Server actions cannot see a bearer token.** A Next server action receives
cookies, not the `Authorization` header the tRPC client attaches — and inside
the drawer there is no usable cookie either. The `/setup` action therefore
authorises with the **setup code** (§7), never an ambient session, and **no
board-surface action may depend on one**. Anything needing the signed-in user
goes through tRPC or a route handler, both of which see headers.

### The generated secret comes from the entrypoint

`BETTER_AUTH_SECRET` is generated and persisted on first boot when unset, so
nobody runs `openssl rand`. It **cannot be read from the database inside the
application**: `betterAuth({...})` is constructed synchronously at module
scope, long before an async call could resolve.

So the container entrypoint owns it: take the advisory lock, run migrations,
read-or-create the instance secret, export `BETTER_AUTH_SECRET`, then `exec`
the server. Module-scope construction stays synchronous and no call site
becomes async. A platform with no entrypoint must set the variable itself, and
the app fails fast if it is missing rather than minting an ephemeral one that
would invalidate every session on restart.

### Deleting `/api/user/upsert-user`

This endpoint is currently **unauthenticated and trusts a client-supplied
`userId`**: it will insert a `user` row, insert a membership, and — via
`onConflict(...).doUpdateSet({ name })` — **overwrite any existing user's
display name**, which is impersonation on a public board.

It is not fixed, it is **deleted**. The endpoint exists only so the client can
obtain `{ user, org }` after sign-in, and `getUserSession` already returns that
shape as an authenticated procedure. `ensureSession` replaces it, deriving
identity from the verified session. A deleted vulnerability cannot regress.

## §4 — Image storage

Uploads move server-side: `POST /api/images` (size-capped, extension allowlist,
magic-byte validation via the `image-size` call already in
`processImagesInHTML`), bytes in Postgres, served by `GET /api/images/<id>`
with `Cache-Control: immutable` and an ETag. URLs are relative, so changing
domain does not orphan stored images.

**Upload cannot require a session.** `feedback-form` calls
`processImagesInHTML(value)` *before* it checks `if (!session)`, so anonymous
visitors attach screenshots today — "Submit Anonymously" is a shipped feature.
Gating `/api/images` on auth would break it in a way that only shows up for
anonymous users with images.

So the endpoint is **unauthenticated but bounded**: the existing per-IP rate
limiter plus `MAX_IMAGE_BYTES` and content validation. Strictly tighter than
today, which hands every visitor a public anon key with insert rights on a
whole bucket.

`GET` stays public — the board is public and images render inside iframes on
third-party domains. Images referenced by no post or comment are swept by the
same opportunistic cleanup as the other unbounded tables (§6).

### Downscale on upload, then serve unoptimized

Post bodies render images through `next/image`, as do the logo and its settings
preview. `remotePatterns` governs *external* URLs only, and every image is now
a same-origin relative `/api/images/:id`, which Next would optimize with no
configuration — so the trade-off is real:

| | Optimizer on | Optimizer off |
|---|---|---|
| Viewer bandwidth | resized + WebP | **full-size original to every visitor** |
| Runtime dependency | needs `sharp` | none |
| Stateless container | re-optimizes after every restart | nothing to cache |

Neither is good. **So the work moves to upload time, in the browser**: before
`processImagesInHTML` uploads, the client downscales to a maximum edge
(~2000px) and re-encodes. Smaller uploads, smaller stored blobs, cheap serving,
**no `sharp` and no optimizer**. `images: { unoptimized: true }` is set
globally — three call sites each needing a prop is three chances to miss one —
as a consequence of already-right-sized images rather than a workaround. The
stored HTML carries `width`/`height`, so layout is unaffected.

`MAX_IMAGE_BYTES` defaults to **4 MB**, applied to **decoded** bytes rather
than the base64 the editor holds (base64 inflates by ~33%), and checked client
-side before upload so an oversized screenshot fails with a clear message
instead of a 413.

## §5 — AI is optional, recommended, and honest about itself

Creating a post makes three model calls inline and throws if any fail: with no
key, `isInappropriateCheck` finds no content, returns `true`, and the post is
rejected as inappropriate. Search is purely vector-based, so with no embeddings
it returns nothing. A keyless instance today is not degraded — it is broken.

### "Unavailable" is not "inappropriate"

```ts
const content = data?.choices?.[0]?.message?.content;
if (!content) return true;          // ← any provider failure reads as "inappropriate"
```

Every non-answer — expired key, exhausted balance, 429, model outage, network
blip — returns `true`, and the caller turns that into
`throw new Error("inappropriate-content")`. **So a key that runs out of credit
silently rejects every post and comment, telling authors their feedback is
inappropriate.** On a feedback product that reads as censorship, is invisible
to the operator, and nothing in the UI hints at billing.

Moderation gains a third outcome: *allowed*, *refused*, **unavailable**.
Unavailable degrades to the keyless path and is logged for the operator rather
than shown to the author. A moderation service that cannot be reached must
never silently become a content ban.

### Images must be sent, not linked

Moderation passes image **URLs** (`image_url: { url }`), so the provider
fetches them. That breaks twice: §4 makes stored URLs relative, which no
external service can resolve, and a board on a private network or `localhost`
is unreachable regardless. Image moderation would fail silently for exactly the
instances least able to notice — while asking a third party to crawl the
instance, which sits badly beside the privacy position below.

Images are **inlined as size-bounded base64**. That works identically on
localhost, a private network and a public instance, and keeps the disclosure
table honest: the bytes go to the provider in the request, or not at all.

### Capability flag

Runtime, surfaced on the existing settings payload. Not simply
`!!OPENROUTER_API_KEY` — a local model needs no key:

```ts
hasLLM = !!process.env.OPENROUTER_API_KEY || !!process.env.LLM_BASE_URL
```

| Surface | With | Without |
|---|---|---|
| Create post | moderation + AI title/category + embedding | title from first sentence, category `general feedback`, no moderation, `embedding` null |
| Create comment | moderation + embedding | stored as written |
| Search | vector similarity, distance cursor | `ILIKE` over title + description |
| Insights, AI roadmap, Ask-AI, "improve draft" | shown | hidden |

**The search fallback reuses the non-search ordering and cursor.** The vector
branch orders by distance and pages on it; with no embeddings there is no
distance, so the `ILIKE` branch filters and then takes the ordinary `orderBy`
path unchanged. Mixing them would produce a cursor referencing a column that is
never selected — a silently broken "load more".

### Any OpenAI-compatible endpoint — including the one that wasn't

`LLM_BASE_URL`, `LLM_MODEL` and `LLM_EMBEDDING_MODEL` point every model call
wherever the operator wants.

An earlier revision described this as "the four hard-coded OpenRouter URLs" and
was wrong twice. There are **five** `fetch` call sites —
`lib/utils-server.ts` (embeddings *and* moderation),
`queries/create-feedback-post.ts`, `trpc/generate-insights.ts`,
`trpc/rewrite-feedback.ts` — and a sixth coupling of a different kind:

**Ask-AI does not use `fetch` at all.** `app/api/chat/route.ts` imports
`createOpenRouter` from `@openrouter/ai-sdk-provider` and passes
OpenRouter-specific provider options. Setting `LLM_BASE_URL` to a local Ollama
would redirect the other five and leave **Ask-AI still talking to OpenRouter,
or failing** — the feature most likely to be used, silently exempt from the
promise this section makes.

So the SDK goes. `@ai-sdk/openai` is **already a dependency** and its
`createOpenAI({ baseURL, apiKey })` speaks plain OpenAI-compatible HTTP, which
OpenRouter also serves — one provider covers both cases, and
`@openrouter/ai-sdk-provider` is removed. Provider-specific options
(`reasoning`, `cacheControl`) are sent **only when the endpoint is actually
OpenRouter**, since a local model will reject or ignore them.

### Optional, recommended, and trustworthy about it

"Turn this on" asks a self-hoster to send their users' feedback to a third
party and to paste a credential into a box. Both deserve to be earned.

**The trust position is structural, and verifiable in this repository:**

| Claim | How it is true |
|---|---|
| The key never reaches a browser | Every model call is server-side. **No client component references it**, checked |
| The key is never logged | No logging on any model code path, checked |
| Nobody else sees the key or the data | There is no Feedbackland server anywhere in a self-hosted install. The request goes from *your* server to *the provider you chose* |
| Nothing phones home | **The source tree contains no analytics, telemetry or error-reporting SDK**, checked |
| It is your account, your limits, your bill | You create the key, set the cap, revoke it |
| Turning it off changes nothing you own | Remove the variable; AI surfaces disappear, posts and history stay |

**What is actually sent:**

| Feature | What leaves the server | When |
|---|---|---|
| Moderation | the post or comment text, and its images | every post and comment |
| Title and category | the post text | every post |
| Semantic search index | the title and text | every post and comment |
| Search | the search query | each search |
| Insights | every post title and body | when insights are generated |
| Ask-AI | the board's posts, plus your question | each question |
| Improve draft | the draft text | only when the author asks |

Nothing is sent when no model is configured, because none of those calls
happen.

**The ladder leads with the option where nothing leaves at all:**

1. **A local model** — Ollama or LM Studio via `LLM_BASE_URL`. Free, open
   source, no account, no key, and the feedback never leaves the machine. The
   honest cost is hardware and a smaller model.
2. **A paid API key** — cents per month for a small board, best quality; the
   table above applies.
3. **Free hosted models** — genuinely $0, and the one to be careful about.
   Rate limits are hard (OpenRouter allows roughly 50 requests a day below $10
   of credit, and a post costs three calls), and **some free endpoints are paid
   for with the prompts themselves — feedback may train a model.** A real
   trade, stated as one.

The admin area carries a single dismissible card covering those three options.
Admins only, never on the public board, and never on the posting path — the one
place an upsell would be hostile to the person giving feedback.

**Adding a key later needs a backfill.** Posts created while keyless have
`embedding = null` and stay invisible to semantic search.
`docker compose exec app node scripts/backfill-embeddings.mjs` embeds every
null row.

## §6 — Schema and migrations

`db/schema.sql` is a Supabase dump: it references `"extensions"."halfvec"` and
writes to `storage.buckets` / `storage.objects`, which do not exist on stock
Postgres. The two files in `db/migrations/` are hand-pasted SQL, and
`CREATE TYPE … AS ENUM` is not idempotent.

Target: an ordered, tracked, idempotent set run by a Kysely `Migrator`.

```
0001_init.sql        base schema, single-tenant, vanilla-Postgres clean
0002_images.sql      §4 image storage
0003_instance.sql    settings row, generated secret, setup code
```

The earlier `0002_insights` / `0003_security` files are folded into `0001`,
since there is no existing database to migrate forward from.

**The target schema, stated so phase 1 is executable without re-deriving it:**

| Table | Change from today |
|---|---|
| `settings` | was `org`; **one row**; drops `orgSubdomain`, keeps `platformTitle`, `platformDescription`, `logo`, `orgName`, `orgUrl`, plus the setup-complete flag, generated secret and setup code |
| `user` | **gains `role`** (`admin` \| `user`); `id` stays `text` |
| `user_org` | **dropped** |
| `feedback` | **drops `orgId`** and its index; `embedding` becomes unqualified `halfvec(3072)` |
| `comment` | unqualified `halfvec`; **gains `ON DELETE CASCADE`** on `authorId`, the only one of the user FKs without it |
| `insights`, `insight_reports` | **drop `orgId`** and its indexes |
| `admin_invites` | **drops `orgId`** |
| `images` | new (§4): id, bytes, content type, size, created |
| `user_upvote`, `activity_seen`, `rate_limit` | unchanged |
| `auth_user`, `auth_session`, `auth_account`, `auth_verification` | created by Better Auth's own migrator, not by `0001` |

Two enums are dropped: `subscription_frequency` and `subscription_name` exist
today and no table uses them. `0001` also drops
two dead enums (`subscription_frequency`, `subscription_name`) that no table
uses, and gives `comment.authorId` the `ON DELETE CASCADE` that the other user
foreign keys already have — without it, deleting a user fails, which Better
Auth's account-deletion flow would hit immediately.

### The schema must not care where pgvector lives

An earlier revision pinned the extension to an `extensions` schema with column
types written `"extensions"."halfvec"`. That matched Supabase and **breaks
everywhere else** — which is where one-click hosting happens. On Neon, Render
and Railway the operator runs `CREATE EXTENSION IF NOT EXISTS vector` and it
lands in `public`; our `IF NOT EXISTS` then finds it installed, does nothing,
and every `extensions.halfvec` reference fails. **The first migration aborts
precisely because the platform was helpful.**

So the schema stops naming a location: `CREATE EXTENSION IF NOT EXISTS vector`,
and columns and opclasses written **unqualified** (`halfvec(3072)`,
`halfvec_cosine_ops`). Resolution is by `search_path`.

### pgvector must be reachable at runtime, not just in DDL

`pgvector/kysely`'s `cosineDistance()` emits a bare operator:

```sql
"feedback"."embedding" <=> $1
```

`<=>` resolves through `search_path`. The failure mode is nasty: **inserts keep
working**, because an unknown literal coerces to the target column type with no
search-path lookup, so embeddings are written correctly and only *searching*
fails.

**The obvious fix is wrong.** Setting it per connection —

```ts
pool.on("connect", (c) => c.query("SET search_path TO ...")); // NO
```

— works against a direct Postgres and **fails intermittently through a
transaction pooler**, which a self-hoster on Neon or Supabase will have: a
`SET` outside a transaction lands on whichever backend is assigned, does not
persist once it returns to the pool, and can leak into another client's
session. `options=-c search_path=…` is no escape either — PgBouncer rejects the
`options` startup parameter.

The fix is a **server-side default**: migration `0001` reads the extension's
actual schema from `pg_extension` and, only if it is not already reachable,
**appends** it via `ALTER ROLE CURRENT_USER IN DATABASE CURRENT_DATABASE() SET
search_path = …`. Appending rather than replacing matters on managed Postgres,
where the connecting role may be shared with the provider's own tooling. If a
provider forbids even that, the fallback is schema-qualifying the operator —
`OPERATOR(<schema>.<=>)` in a local helper replacing `cosineDistance`, with the
schema from the same lookup.

### Boot sequence

Run by the container entrypoint inside one `pg_advisory_lock` so concurrent
starts serialise:

```
client = await pool.connect()          // a dedicated session, not the pool
  pg_advisory_lock(<constant>)         // session-scoped: released if we crash
    → db/migrations/*.sql via Kysely Migrator (tracked in schema_migrations)
    → getMigrations(auth.options).runMigrations()      [auth_* only]
    → ensure settings row, instance secret, setup code
  pg_advisory_unlock
client.release()
```

The lock needs a **dedicated client checked out of the pool**:
`pg_advisory_lock` is session-scoped, and a pooled query could take it on one
connection and release it on another. One session also means a crashed
migration releases the lock on disconnect rather than wedging every future
boot.

**Migrations must use a direct connection, never a transaction pooler** — the
same session-scoping makes the lock unsafe there, acquirable on one backend and
released on another, silently. `DIRECT_DATABASE_URL` is optional and defaults
to `DATABASE_URL`, so the bundled compose stays a single value while a
self-hoster on a pooled managed Postgres has the escape hatch.

**Housekeeping.** Three tables grow without bound and a container has no cron:
`rate_limit`, `auth_verification` and `auth_session`. `checkRateLimit` already
writes on every call, so it opportunistically deletes rows whose window closed
long ago; the two `auth_*` tables are pruned by the same sweep, keyed off
`expiresAt`. Orphaned images go with them (§4).

**`db/schema.ts` is generated.** It comes from `npm run kysely-codegen` against
a live database, so the order is: migrate a local Postgres, regenerate, commit.
The current file also carries Supabase-internal schemas (`realtime.*`,
`storage.*`, `auth.*`) that vanish when regenerated against stock Postgres —
intended and safe, since it is the only file referencing them.

## §7 — First run

No claimed instance → `/setup` → one form (product name, your name, email,
password) → creates the settings row, the identity, the `user` row with
`role = admin`, and marks setup complete → redirect to `/`, signed in.
Afterwards `/setup` redirects to `/`.

### Setup cannot be hijacked

An instance reachable on the internet before it is claimed would otherwise
grant admin to whoever loads `/setup` first. It therefore **always** requires a
one-time **setup code**, generated on first boot, stored in the instance row,
and cleared once setup completes.

An earlier revision made the code conditional on a loopback address. **That is
not implementable**: `NextRequest` in Next 16 exposes no socket remote address
(`request.ip` was Vercel-only and is gone), so the only signal is
`x-forwarded-for` — client-supplied, and precisely what must not be trusted for
an authorisation decision. A rule that degrades to "trust a spoofable header"
is worse than no rule.

The Docker quick start runs in the foreground and prints the code in the
startup banner, in the terminal the operator is already watching;
`docker compose logs app | grep "Setup code"` covers the detached case;
`SETUP_CODE` may be pre-set for automation; and the one-click template prompts
for it during the deploy wizard (§8), which is what makes it workable for
someone who never opens a terminal.

Binding the published port to `127.0.0.1` instead was considered and rejected:
it breaks the reasonable "bring it up on a VPS and visit `http://ip:3000`"
flow, trading a visible one-line step for an invisible connection failure.

**`/setup` is rate-limited** — a setup code guessable at unlimited speed is not
a control.

Before setup completes, `resolveSettings` returns nothing and the board cannot
render, so the redirect happens in the server component **before** any
org-scoped query mounts, and `/setup` lives outside the `(board)` group.

## §8 — Packaging

Two ways in, ordered by how little the reader needs to know:

| | Who | What they do | Terminal? |
|---|---|---|---|
| **One-click deploy** | anyone | Click, sign in, pick a password, wait ~3 min | **No** |
| **Docker Compose** | comfortable in a terminal | Save a file, run one command | Yes |

### One-click deploy

A `render.yaml` blueprint lives in the repository and the README carries the
button. Every capability it relies on is confirmed present in Render's spec:

| Need | Mechanism |
|---|---|
| Run our prebuilt image, no build step | `image:` pointing at the GHCR tag |
| Provision Postgres and wire it up | `databases:` + `fromDatabase` → `connectionString` |
| Generate the auth secret | `generateValue: true` |
| **Let the operator choose the setup code** | `sync: false`, which prompts during deploy |
| Tell the app it is behind a proxy | `TRUST_PROXY=true` |
| Know when it is ready | `healthCheckPath: /api/health` |
| Stop our pushes redeploying their instance | `autoDeployTrigger: off` |

Confirmed: the button needs **no fork** — a public repository deploys directly.

**Only Render ships a button initially, and that is a correctness decision.**
Railway's deploy URL is `railway.com/new/template/{code}`, where the code is
issued when a template is created and published through their dashboard — it
cannot be pointed at a repository URL, which an earlier draft did, producing a
link that would 404. Publishing a Railway template is work in their UI, so it
is a follow-up and the second button appears when the code exists. One button
that works beats two where one is broken, especially for an audience with no
way to diagnose it.

**Costs are led with, not buried.** Render's free database is deleted after 30
days and its free service sleeps for about a minute — which for an embedded
widget means the drawer hangs on first open. The docs state the real figure
(~$7/month) in the prerequisites.

### The image

Multi-stage, non-root, `output: "standalone"` unconditionally (nothing deploys
to a platform that would object), published to GHCR by CI on tag. No `sharp`
(§4 turns optimization off).

**The build stage must install dev dependencies and build the workspace.**
`components/app/widget-docs/index.tsx` imports `FeedbackButton` from
`feedbackland-react`, and the root build is
`npm run build -w feedbackland-react && next build`. A conventional
`npm ci --omit=dev` runner shortcut breaks the build outright, and the widget's
own build runs `tsc -b` + vite under `typescript@7`, relying on the
`@typescript/typescript6` fallback. The runner stage copies only
`.next/standalone`, `.next/static` and `public`.

**`ENV HOSTNAME="0.0.0.0"` is mandatory.** Without it the standalone server
resolves the machine's hostname — inside Docker, the container id — and binds
there. The process starts, the logs look healthy, and **nothing can reach it**.
It presents as "the image is broken", the worst possible first impression.
`ENV PORT=3000` sets a default that a platform-injected `PORT` overrides, which
is what makes Cloud Run, Railway, Render and Fly work unmodified.

**The image must be multi-architecture.** A large share of self-hosters develop
on Apple Silicon, and an `amd64`-only image either refuses to run or crawls
under emulation. CI publishes `linux/amd64` and `linux/arm64`;
`pgvector/pgvector` is already multi-arch.

**`GET /api/health`** returns 200 when the database answers, 503 otherwise.

### Bring-your-own Postgres

The bundled `pgvector/pgvector` image has the extension; an existing Postgres
may not. `CREATE EXTENSION vector` then fails, and the failure must read as a
prerequisite rather than a crash: the migration aborts naming the extension,
the server, and the two ways forward. pgvector is available on RDS, Cloud SQL,
Neon, Supabase and every mainstream managed Postgres.

Making it optional was considered — embeddings are only written when a model is
configured — and rejected: the columns and HNSW indexes are in the base schema,
and conditional DDL would fork the schema for a shrinking minority.

**TLS is the other snag**, and a known one: managed providers commonly require
encrypted connections and `pg` will not negotiate one by default, so
`?sslmode=require` is documented in the env reference rather than left in a
troubleshooting appendix.

### Compose

```yaml
services:
  db:
    image: pgvector/pgvector:pg18
    restart: unless-stopped
    environment: [POSTGRES_PASSWORD=feedbackland, POSTGRES_DB=feedbackland]
    volumes: [db:/var/lib/postgresql/data]
    healthcheck:
      # -h forces TCP; without it this passes during the database's own
      # first-time setup, while it is still socket-only.
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres -d feedbackland"]
  app:
    image: ghcr.io/feedbackland/feedbackland:1
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://postgres:feedbackland@db:5432/feedbackland
    ports: ["3000:3000"]
    depends_on: { db: { condition: service_healthy } }
    healthcheck: { test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"] }
volumes: { db: }
```

The database port is deliberately **not published**. The image is pinned to a
major tag so `docker compose pull` cannot jump a major version underneath a
running instance.

**Adding a domain** adds a reverse proxy and sets `DOMAIN` and
`TRUST_PROXY=true`. Not optional in practice: host pages are HTTPS, so an HTTP
board in an iframe is blocked as mixed content. Caddy is documented because it
gets TLS right in one line, but **any reverse proxy works** — the requirements
are only that it forwards `x-forwarded-host`/`-proto`, does not buffer the
Ask-AI stream (`flush_interval -1`), and allows a long read timeout for insight
generation, which batches a whole board through the model.

**An all-in-one image was considered and rejected.** Bundling Postgres into the
app image would reduce this to a single `docker run` with no file to save. The
cost lands on the least recoverable thing: Postgres major-version upgrades
inside an application image are painful, and the failure mode is a self-hoster
who cannot upgrade without risking their only copy of the data.

### The complete vendor surface

| Dependency | When | Verdict |
|---|---|---|
| **Postgres + pgvector** | runtime, required | The one hard dependency. Any Postgres |
| **npm registry** | build | Unavoidable for any Node project |
| **GHCR** | distribution | Convenience only; the Dockerfile is in the repo |
| **A model provider** | runtime, optional | Off by default; `LLM_BASE_URL` points anywhere, including a local model (§5) |
| **Caddy / Let's Encrypt** | optional | Open source, swappable, any proxy works |
| **Render** | optional | One convenience path; the same image runs anywhere |

**Google Fonts is removed.** `next/font/google` downloads Inter and Roboto Mono
**at build time** — Next then self-hosts them, so runtime is already clean, but
a build needs network access to Google, which breaks air-gapped and
reproducible builds. Both faces are OFL, so the `.woff2` files are vendored and
loaded with `next/font/local`.

**Four vendor packages leave `package.json`**: `@openrouter/ai-sdk-provider`,
`@supabase/supabase-js`, `firebase`, `firebase-admin`. An unused dependency
still ships in every install and still invites someone to reach for it. The
committed `supabase/` CLI directory — including a `project-ref` identifying a
specific project — and the `schema-dump` script that shells out to the Supabase
CLI go with them.

**Zero `NEXT_PUBLIC_*` variables remain**, which is what makes one prebuilt
image serve every operator.

**The container needs no writable filesystem** beyond `/tmp`, so it can run
read-only. Being stateless, more than one app container can run against the
same database: migrations serialise on the advisory lock, and rate limits and
sessions live in Postgres.

**Leaving is as easy as arriving.** Identity, content *and images* live in one
Postgres, so a single `pg_dump` is a complete, portable copy — restore it
anywhere and the instance comes back whole.

## §9 — The widget

This is where the reset is visible from outside. `feedbackland-react` currently
resolves a board from `platformId` by building
`https://<platformId>.feedbackland.com`, and posts feedback to
`https://api.feedbackland.com/api/feedback/create` when given no `url`.

**Both of those hosts are going away**, so the fallback is not merely unused —
it is a trap that would silently point a self-hoster's widget at a domain that
no longer answers.

The widget therefore takes **one required prop**:

```tsx
<FeedbackButton url="https://feedback.example.com" />
```

`platformId` is removed along with `DEFAULT_BOARD_DOMAIN` and
`DEFAULT_API_ENDPOINT`. The org id it carried is meaningless now — with one
board, `/api/feedback/create` needs no identifier in the body, and the
submission endpoint is derived from `url`'s origin exactly as it already is.

This is a **breaking change and a new major version** of the npm package.
Earlier revisions treated "no npm release" as a constraint; that constraint
existed to protect users of the hosted service, and there is no hosted service.
Shipping a package whose default behaviour points at a dead domain would be
worse than a major bump.

## §10 — Runtime configuration reaching the client

Two UI decisions depend on configuration, and neither can be a build-time
constant in a prebuilt image: whether AI surfaces are shown (`hasLLM`, §5), and
the widget snippet the admin Widget page generates.

`getIsSelfHosted()` / `useIsSelfHosted()` and the `SELF_HOSTED` /
`NEXT_PUBLIC_SELF_HOSTED` variables are **deleted**: everything is self-hosted
now, so the question has no meaning. The settings payload — already fetched
globally — carries `{ hasLLM }`, and the snippet is built from
`window.location.origin`.

## Environment reference

Nothing below is required for `docker compose up` to work.

| Variable | Default | Effect |
|---|---|---|
| `DATABASE_URL` | set by compose | **The only hard dependency** |
| `DIRECT_DATABASE_URL` | `DATABASE_URL` | Session-mode URL for migrations; needed if `DATABASE_URL` is a transaction pooler (§6) |
| `PORT` / `HOSTNAME` | `3000` / `0.0.0.0` | Set in the image; a platform-injected `PORT` wins (§8) |
| `APP_URL` | inferred | Pins the public origin behind a proxy |
| `TRUST_PROXY` | `false` | Honour `x-forwarded-host`/`-proto`/`-for` |
| `BETTER_AUTH_SECRET` | generated | Entrypoint generates and persists it |
| `SETUP_CODE` | generated | Pre-set for automation (§7) |
| `SMTP_URL` / `SMTP_FROM` | unset | Self-service password reset |
| `GOOGLE_CLIENT_ID` / `_SECRET` | unset | Google sign-in |
| `MICROSOFT_CLIENT_ID` / `_SECRET` / `MICROSOFT_TENANT_ID` | unset / `common` | Microsoft sign-in |
| `OPENROUTER_API_KEY` | unset | AI via OpenRouter |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_EMBEDDING_MODEL` | OpenRouter defaults | Any OpenAI-compatible endpoint; also enables AI without a key |
| `MAX_IMAGE_BYTES` | `4000000` | Upload cap, decoded bytes |

**Deleted:** `SELF_HOSTED`, `NEXT_PUBLIC_SELF_HOSTED`, every
`NEXT_PUBLIC_SUPABASE_*`, every `FIREBASE_*`, `VERCEL_URL` /
`NEXT_PUBLIC_VERCEL_URL`, and the multi-tenant and demo variables.

## §11 — Documentation

`SELFHOSTING.md` is already written around this shape: a one-click deploy
first, Docker second, then backups, AI and troubleshooting. It needs the widget
prop corrected (§9) and the remaining optional sections completed.

`README.md` needs the larger change — it currently advertises a hosted service,
a live demo on `demo.feedbackland.com`, and "hosted free at feedbackland.com".
All of that goes; the pitch becomes the self-hosted product.

## Surfaces to change

**New** — `render.yaml` + deploy button; `lib/auth/{server,client}.ts`;
`app/api/auth/[...all]/route.ts`; `app/api/images/route.ts` +
`app/api/images/[id]/route.ts`; `app/api/health/route.ts`; `app/setup/`;
`scripts/{migrate,backfill-embeddings,reset-password,drawer-auth-check}.mjs`;
`db/migrations/000{1..3}_*.sql`; `Dockerfile`, `.dockerignore`, `compose.yml`,
`compose.tls.yml`, `Caddyfile`, `.github/workflows/publish-image.yml`; vendored
font files.

**Changed** — `next.config.ts` (standalone, `images.unoptimized`, `headers()`);
`db/db.ts`; `proxy.ts` (embed header only); `lib/trpc.ts` (session, no org);
`lib/utils.ts` (URL helpers deleted); `lib/api-snippets.ts` (no org id);
`lib/rate-limit.ts` (**instance cap, §1**); `lib/utils-server.ts` (LLM base URL,
moderation outcomes, inline images); `lib/schemas.ts`; `hooks/use-auth.tsx`;
`providers/trpc-client.tsx`; `app/api/chat/route.ts` (**own inline auth; the
OpenRouter SDK**); `app/api/feedback/create/route.ts`; **every file carrying
`orgId` (81)**; `queries/check-rate-limit.ts`; `components/app/*`;
`components/app/ask-ai/storage.ts`; `db/schema.ts` (**regenerate**);
`feedbackland-react/*` (**major version, §9**); `SELFHOSTING.md`; `README.md`;
`.env.example`.

**Deleted** — `firebaseConfig.ts`; `lib/firebase/`; `lib/supabase.ts`;
`hooks/{use-subdomain,use-maindomain,use-vercel-url,use-is-self-hosted,use-sse,use-platform-url}.ts`;
`providers/iframe.tsx` + `iframeParentAtom`; `app/api/org/[orgId]/`;
`app/api/user/upsert-user/`; `app/get-started/`; `app/[orgSubdomain]/claim/`;
`app/design-preview/`; the `supabase/` directory; the `schema-dump` script; and
the four vendor dependencies above.

## Delivery plan

| # | Phase | Gate |
|---|---|---|
| 1 | **Schema *and* the org removal, together** — single-tenant `0001`, unqualified pgvector, `search_path`, advisory lock, entrypoint owns secret + setup code; and `orgId`, `user_org`, `platformUrl`, `lib/trpc.ts` | Fresh DB converges on stock Postgres **and** on a managed one with pgvector pre-installed in `public`; concurrent boots serialise; `grep` finds no org identifier; typecheck and build clean; **the app boots and serves a board** |
| 2 | Dockerfile + compose + health, multi-arch, `HOSTNAME`/`PORT` | Image builds **including the widget workspace** and boots on both architectures |
| 3 | Routing: `app/(board)` at root; framing headers | Board at `/`, admin at `/admin`, `/admin` refuses to be framed |
| 4 | Better Auth replaces Firebase; `ensureSession`; linking off; reset tiers | Sign-up/in/out; the old REST route is gone and unreferenced; no token survives sign-out |
| 5 | **Drawer auth acceptance test** | Merge blocker |
| 6 | Postgres image storage; client-side downscale; `unoptimized` | Anonymous and signed-in uploads both work; cap enforced |
| 7 | AI optional: unavailable ≠ inappropriate, `ILIKE`, inline images, generic provider, backfill | Keyless instance fully usable; an invalid key does not reject posts |
| 8 | First run `/setup` + setup code | Fresh volume → admin in one form; `/setup` refuses without the code |
| 9 | One-click `render.yaml` + button; vendored fonts; dependency removals | Someone with no terminal open reaches a working board |
| 10 | Widget major version (§9); docs and README rewrite | `<FeedbackButton url="..."/>` works against a self-hosted board |

**Phases 1's two halves cannot be split.** An earlier ordering shipped the
schema first and removed `orgId` from the code second, which leaves the app
unable to boot in between — the code would select a column the migration just
dropped. A phase whose end state is a non-running application is not a phase
boundary, it is a half-finished change with a gate attached. They land
together, and the gate says the app serves a board.

**Rollback:** every phase is code-only and reverts by redeploying. With no
production data anywhere, the database can be rebuilt from migrations at any
point — the single largest risk reduction in this plan.

## Risks

| Risk | Mitigation |
|---|---|
| Auth fails in the drawer's cross-origin iframe | **Retired.** Both paths proven end-to-end, including the no-hidden-cookie check (§3) |
| Popup OAuth breaks where `localStorage` throws | **Measured and fixed**; own completion-message listener + memory store |
| Better Auth takes over `public.user` | **Retired.** `auth_*` renaming verified: `toBeAdded: (none)`, rows untouched |
| The widget's `sandbox` loses `allow-same-origin` later | Recorded as load-bearing in `OverlayWidget.tsx`; asserted by the acceptance test |
| Auto-linking enables account takeover on unverified emails | Linking disabled; only from an authenticated session |
| Removing `orgId` across 81 files breaks something quietly | Mechanical, compile-time, and no data to corrupt; phase 1's gate is typecheck, build **and the app serving a board** |
| `getPlatformUrl` deleted blindly turns the admin invite link into a useless relative path | The three call sites needing absolute URLs are named in §1 and asserted by verification 4 |
| The per-org rate limit is dropped as meaningless once there is one org | It becomes an instance-wide cap; it is the only bound on a public endpoint spending model credit (§1) |
| A managed platform pre-installs pgvector in `public` and the first migration aborts | Extension schema discovered, never assumed; DDL unqualified (§6) |
| `search_path` set per connection is dropped or leaked by a pooler | Server-side `ALTER ROLE … SET`, appending not replacing (§6) |
| Advisory lock acquired and released on different backends | Migrations use `DIRECT_DATABASE_URL` in session mode (§6) |
| Container starts, logs look healthy, nothing can reach it | `ENV HOSTNAME="0.0.0.0"`; platform `PORT` honoured (§8) |
| Auth rate limiting keyed to the proxy IP, locking out everyone | `advanced.ipAddress.headers` only under `TRUST_PROXY`; limits in the database (§3) |
| `/admin` clickjacked through an iframe | Per-route `frame-ancestors`; board stays `*` (§2) |
| `/setup` hijacked on an exposed instance | Setup code always required; no reliance on a spoofable header (§7) |
| An exhausted or invalid key rejects every post as "inappropriate" | Moderation gains an *unavailable* outcome (§5) |
| "Bring your own endpoint" silently excludes Ask-AI | OpenRouter SDK replaced with the generic provider already in the tree (§5) |
| The published widget points at a domain that no longer exists | `url` becomes required; major version (§9) |
| `amd64`-only image unusable on Apple Silicon | CI publishes both architectures (§8) |

## Verification

1. `npm run typecheck` and `npx next build` clean. (`npm run lint` is known
   broken on Next 16 and is not a gate.)
2. **The primary flow, from an empty volume**: `docker compose up` → setup code
   from the banner → `/setup` → post → comment → upvote → search → admin →
   widget embeds and submits from another origin.
3. **Drawer auth acceptance test — merge blocker.** A page on a different site
   embedding the real widget; entirely inside the drawer: sign up, sign out,
   sign in; upvote and comment; reload and stay signed in; social sign-in via
   popup; then repeat with cookies blocked for the board origin, and again with
   `localStorage` forced to throw. Chrome and Firefox at minimum. **Committed
   as `scripts/drawer-auth-check.mjs`** — the repo has no test runner, so an
   uncommitted manual procedure would rot.
4. **No org remains**: a grep for `orgId`, `user_org`, `orgSubdomain`,
   `platformUrl`, `useOrg`, `createOrg` and `claimOrg` over `app/`, `lib/`,
   `components/`, `hooks/`, `queries/`, `trpc/` and `db/` returns nothing —
   and separately, the **admin invite link and widget snippet are still
   absolute URLs**, which is what a careless `getPlatformUrl` removal breaks.
5. **Security**: `/api/user/upsert-user` no longer exists and nothing
   references it; `/setup` without the code is rejected and the code stops
   working once setup completes; a second sign-in method on an existing email
   does not auto-link; a token captured before sign-out is rejected after;
   `/admin` responds `frame-ancestors 'none'` while the board responds `*`;
   repeated failed sign-ins rate-limit **that address only**.
6. **Semantic search on stock Postgres** and **through a pooled connection**: a
   post is created *and then found by a semantically-related query*. An
   insert-only check passes while search is broken; a direct-connection check
   passes while a pooled deployment is broken.
7. **The one-click path, walked without a terminal**: from the README button —
   sign in, choose a setup code when prompted, open the HTTPS URL, complete
   setup, post, and embed the widget on another origin. Against a platform
   whose Postgres pre-installs pgvector in `public`.
8. **Runs somewhere that is not Compose**: the same image on a platform that
   injects its own `PORT`, against a managed Postgres over TLS — the two
   failures invisible from a compose-only run.
9. **Keyless**: everything in 2 with no model configured; AI surfaces absent,
   posting and search working, "load more" paging correctly under `ILIKE`.
10. **Broken key, not absent key**: an invalid or exhausted key leaves a post
    **accepted** without AI enrichment and logged, rather than rejected as
    `inappropriate-content`. Repeat for 429 and 402.
11. **Local model — the real vendor-neutrality test**: `LLM_BASE_URL` at
    Ollama, no key present, and **no outbound request to openrouter.ai at all**.
    Post creation produces an AI title, search finds a related post, **and
    Ask-AI answers** — the one hard-wired to OpenRouter's SDK. Then
    `backfill-embeddings` makes older keyless posts searchable.
