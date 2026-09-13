# One deployment, two tenancy modes

**Status:** approved design · revised after a full critical audit
**Date:** 2026-09-13
**Supersedes:** the two-build-profile design in this file's earlier revisions
(see git history). The mandate changed: **one version**, hostable either as a
multi-tenant platform or — the focus — as a dead-simple single-tenant
self-hosted instance, with vendor lock-in minimised in both.

## Problem

Feedbackland has one deployment shape and it is welded to three vendors:

- **Firebase** is authentication, with its config *committed to source*
  (`firebaseConfig.ts`), so self-hosting requires editing and committing code.
- **Supabase** is the database *and* the image store; images upload straight
  from the browser with a public anon key.
- **Vercel** is assumed rather than chosen: no Dockerfile,
  `getIsSubdirOrg()` hard-codes `vercel.app`, `getVercelUrl()` builds the
  operator's own board URL from `VERCEL_URL`.

`SELFHOSTING.md` is 22 KB, needs four accounts and ten environment values, and
asks the operator to paste a SQL dump into a web console. Meanwhile
multi-tenancy is pure overhead for someone who wants one board.

## Goals

1. **One codebase, one set of technologies, one application behaviour.**
   Packaging differs by target; no application code branches on it.
2. **Production keeps working as it does now**: multi-tenant on Vercel at
   `<tenant>.feedbackland.com`, via a wildcard domain.
3. **Single-tenant self-hosting is trivial** and is what everything else is
   optimised around: `docker compose up`, zero accounts, zero env values.
4. **Minimal lock-in for self-hosters.** The only hard dependency is a
   Postgres database. Production's dependence on Vercel is a deployment
   choice, not something the code encodes — the same image runs anywhere.
5. **Existing tenants notice nothing.** Same board URLs, same widget snippets,
   same data, same admin roles, and the **same sign-in credentials** — one
   re-login is the entire visible footprint of the change (§12).
5. Sign-in works inside the drawer widget's cross-origin iframe — **proven**
   for both password and social paths (§3).

## Non-goals

- ~~Preserving existing `feedbackland.com` accounts.~~ **Reversed.** An
  earlier revision treated this as unnecessary and stated that nobody would be
  able to sign into existing accounts. Existing tenants continuing to work
  unchanged is now a hard requirement, so account preservation is a **goal**
  with its own section (§12), not an omission.
- Multi-tenant single sign-on across tenants (§3, "Multi-tenant origins").
- Changing the published `feedbackland-react` npm package (§9).
- Customer custom domains. The chosen TLS approach makes them nearly free
  later; not built now.
- An S3 storage backend. Postgres is the only image store; S3 is an additive
  option later (§4).

## The shape of the answer

Two observations collapse most of the complexity.

**The app is *almost* entirely org-scoped.** Nearly every query takes an
`orgId`, so multi-tenancy mostly decides *how `orgId` is derived from a
request*, and single-tenant is the same product with a constant resolution
strategy. Multi-tenant support therefore stays in the code permanently and
costs almost nothing.

An earlier revision of this document stated that flatly — "every query takes
an `orgId`" — and an audit found it false. Four queries fetch or mutate by
primary key with no tenant predicate at all (§1, "Cross-tenant object
access"). The premise survives, but only because those four are fixed as part
of this work rather than assumed away.

**With no requirement to keep production on Firebase and Supabase, there is
nothing left to abstract.** The previous design needed ports and adapters only
so two profiles could diverge. One version needs one auth, one storage, one
everything — so the adapter layer disappears, along with the build-time
bundler aliasing that was the riskiest mechanism in that plan.

```
                   ┌──────────────────────────────────────┐
                   │  ghcr.io/feedbackland/feedbackland   │
                   │  Next.js (standalone) + Better Auth  │
                   └──────────────────┬───────────────────┘
                                      │  DATABASE_URL
                                      ▼
                        ┌────────────────────────────┐
                        │  Postgres + pgvector       │
                        │  data · identity · images  │
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
  host == ROOT_DOMAIN / www  → no tenant (signup)
  <label>.ROOT_DOMAIN:
      label reserved         → no tenant
      label is a uuid v4     → org by id
      otherwise              → org by orgSubdomain
```

The host is normalised before any of this: lower-cased, port stripped, and
trailing dot removed. `ACME.Example.com`, `acme.example.com:3000` and
`acme.example.com.` are the same tenant, and `acme.localhost:3000` must match
in development — a raw `Host` comparison fails all three.

Resolution is memoised per host with a short TTL, **including negative
results**, and invalidated on org update. `x-forwarded-host` is honoured only
when `TRUST_PROXY=true` (§3, "Proxy trust").

`reservedSubdomains` is corrected to `["www", "api", "auth", "admin", "app",
"static", "public", "assets", "setup", "signup", "feedback", "new"]` —
today's list still contains `get-started` (a route being removed) and omits
`www`, `setup` and `signup`, each of which is now a real route or host.

Local multi-tenant development uses `acme.localhost:3000`; browsers resolve
`*.localhost` to loopback, which replaces subdir mode outright.

### Security fix: `/api/user/upsert-user`

This endpoint is currently **unauthenticated and trusts a client-supplied
`userId`**: `upsertUserSchema` takes `userId`, `email` and `orgSubdomain`
straight from the request body, and `upsertUserQuery` will insert a `user`
row, insert a `user_org` membership, and — via
`onConflict(...).doUpdateSet({ name })` — **overwrite any existing user's
display name**, which is impersonation on a public board. There is no
privilege escalation (the role is hard-coded `user`), but arbitrary user
creation and renaming is live today.

The redesign rewrites this exact path, so it is fixed as part of the work: the
server derives `userId` and `email` from the **verified session** and the org
from `Host`. `upsertUserSchema` keeps only `name` and `photoURL`. This is
listed as a deliverable, not a side effect, so it gets a test.

### Cross-tenant object access

Host-based resolution decides *which* org a request belongs to. It does
nothing if a query then ignores that org — and four do. Each fetches or
mutates by primary key with **no tenant predicate**:

| Query | Current `where` | Consequence |
|---|---|---|
| `getFeedbackPostQuery` | `feedback.id` only | Reads any org's post by id. It even *selects* `orgId` without filtering on it, and `trpc/get-feedback-post` never compares it to `ctx.orgId` |
| `getCommentQuery` | `comment.id` only | Reads any org's comment by id |
| `upvoteFeedbackPostQuery` | `postId` only | **Mutates** another org's post: upvote or, with `allowUndo`, downvote |
| `upvoteCommentQuery` | `commentId` only | Same, for comments |

**Honest severity:** boards are public and ids are v4 UUIDs, so the reads leak
data that is already readable to anyone who has the id, and nothing is
enumerable. The upvote paths are worse — an unauthorised cross-tenant
*mutation* — though still gated on knowing an id. For a single-tenant
self-hoster it is a non-issue by construction: there is one org.

It is fixed here regardless, because this design's entire claim is that the
same artefact is safe to run as a multi-tenant platform, and "tenant isolation
depends on ids being hard to guess" is not a claim worth making. The two reads
take `orgId` and filter on it; the two upvotes verify the target belongs to
`ctx.orgId` (comments join `feedback` for theirs, since `comment` carries no
`orgId` column). Each gets a test that asserts a cross-org id is rejected.

`set-activities-seen` and `update-user` also lack an `orgId`, but are scoped
by `userId` and are correct as they stand; `get-org`, `has-claimed-org` and
`check-rate-limit` are deliberately instance-level.

**Deleted by this section:** `getSubdomain`, `getMaindomain`,
`getIsSubdirOrg`, `navigateToSubdomain`, `getVercelUrl`, `useSubdomain`,
`useMaindomain`, `useVercelUrl`, the `subdomain` request header, and
`app/api/org/[orgId]/route.ts` with the UUID-subdomain redirect in `proxy.ts`
that depends on it. They are deleted rather than deprecated, so every stale
caller becomes a compile error.

`app/api/chat/route.ts` is an easy one to miss: it does its own auth and
tenancy inline (`req.headers.get("subdomain")` plus a Firebase token check in
`resolveAdminOrgId`) rather than going through tRPC context, so it must be
migrated to `Host` + `auth.api.getSession` by hand.

`components/app/ask-ai/storage.ts` is the subtle one. It builds its
sessionStorage key from `getSubdomain()` and **returns `null` when there is no
subdomain**, so every read yields `[]` and every write no-ops. Delete
`getSubdomain` without touching it and Ask-AI conversation history silently
stops persisting in single-tenant mode — no error, no crash, a smoke test
still passes. It is re-keyed on the resolved org id.

### Dead code that looks load-bearing

Three paths in this codebase read as live infrastructure and are not. Each is
deleted, and each is listed here because an implementer who assumes they
matter will either preserve them for nothing or draw a wrong conclusion from
them:

- **`lib/firebase/admin.ts: adminDatabase`** — a Firebase Realtime Database
  handle, imported by nothing. It is the sole reason `FIREBASE_DATABASE_URL`
  is a documented required variable that the guide tells operators to invent a
  plausible value for.
- **`hooks/use-sse.ts`** — nothing constructs an `EventSource`. Worth
  recording *why* it must not come back casually: `EventSource` cannot send an
  `Authorization` header, so any future SSE endpoint would need a cookie this
  architecture deliberately does not have, or a token in the query string.
  Streaming here goes over `fetch`, as Ask-AI already does.
- **`providers/iframe.tsx` + `iframeParentAtom`** — a penpal RPC channel to
  the embedding parent with `allowedOrigins: ["*"]`, never mounted. It is easy
  to mistake for the widget's communication layer during an auth or embedding
  change; the real board↔widget protocol is the `postMessage` readiness
  handshake in the root layout and `platform-ready-signal`.

## §2 — Routing

`app/[orgSubdomain]/(board)/…` becomes `app/(board)/…`. Because the tenant
lives in the hostname, **URLs are identical in both modes**: `/`, `/<postId>`,
`/admin`.

Wherever a tenant resolves, `/` is the board. The single exception is the root
domain in multi-tenant mode, where no tenant resolves and `/` redirects to
`/signup`. That redirect belongs in the `(board)` **layout**, not the page: a
layout wraps its pages, so redirecting from the page would still render the
board chrome — header, org title, account controls — for a request that has no
org at all, against a `useOrg` query that cannot succeed. `/signup` and `/setup` live outside the `(board)` route group so
the board chrome does not wrap them. Keeping one `/` route that branches on
the resolved tenant avoids two route trees both claiming `/` — a hard Next.js
build error, not a preference.

`[postId]` is now a root-level dynamic segment, so it is guarded to UUIDs;
anything else 404s rather than attempting a post lookup. Static segments
(`admin`, `signup`, `setup`, `api`) take precedence in Next's matcher.

**Routes removed:** `app/get-started/` (becomes `/signup`),
`app/[orgSubdomain]/claim/`, and the claim step of
`components/app/create-org-wizard/` — first-admin creation is now part of one
form (§8). The empty leftover `app/design-preview/` directory goes too.

**No middleware is required for tenancy**, which matters because
[vercel/next.js#86122](https://github.com/vercel/next.js/issues/86122) reports
`proxy.ts` silently not executing under `output: "standalone"` behind some
reverse proxies. `proxy.ts` is reduced to one job — setting the
`?embed=drawer` header for correct first paint — which degrades to a single
frame of flash if it never runs.

Cost: pages that read `Host` render dynamically. Accepted.

### Framing policy — the board must be embeddable, the admin must not

The app currently sets **no security headers at all**: no `X-Frame-Options`,
no CSP, nothing. Every route is embeddable by any site, which is *required*
for the board — the drawer widget's whole purpose — and *wrong* for everything
else. `/admin` being framable by an arbitrary origin is a clickjacking target:
an admin who is signed in can be induced to click destructive controls inside
an invisible frame.

The board cannot be protected here — `frame-ancestors *` is the feature — so
the policy is per route, set in `next.config.ts` `headers()`:

| Routes | `Content-Security-Policy` |
|---|---|
| board (`/`, `/<postId>`) | `frame-ancestors *` — embedding is the product |
| `/admin/*`, `/setup`, `/signup`, `/api/auth/*` | `frame-ancestors 'none'` |

`/api/auth/*` is in the deny list because the OAuth popup is a top-level
window by construction; nothing legitimate frames it.

A stricter full CSP is deliberately **not** attempted here. The root layout
ships an inline boot script (theme sync and the readiness ping, which must run
before first paint) and Better Auth's popup completion page ships its own
inline script — the package exports `OAUTH_POPUP_SCRIPT_CSP_HASH` precisely
for that. Both would need hashing or a nonce, and getting it wrong breaks
first paint or sign-in. Framing is the risk that actually applies to this app;
it is fixed, and the rest is left as a separate, testable piece of work rather
than half-done here.

## §3 — Auth

**Better Auth everywhere.** Firebase is deleted, not abstracted.

### Table ownership — verified, not assumed

Better Auth creates a table literally named **`user`**, which collides with
the application's existing `public.user` (five foreign keys point at it:
`activity_seen`, `comment.authorId`, `feedback.authorId`, `user_org.userId`,
`user_upvote.userId`). Its models are therefore renamed:

```ts
user:         { modelName: "auth_user" },
session:      { modelName: "auth_session" },
account:      { modelName: "auth_account" },
verification: { modelName: "auth_verification" },
```

This was **verified against a database pre-loaded with the app's real `user`
table and a `user_org` row**: `getMigrations` reported `toBeCreated:
auth_user, auth_session, auth_account, auth_verification` and `toBeAdded:
(none)`; the app's user columns and rows were untouched; and a real sign-up
wrote one `auth_user` row while `public.user` stayed at its original count.

Identity lives in `auth_*`. The app's `public.user` / `user_org` remain the
application's own model, populated on sign-in by the **existing `upsertUser`
mirror** with `user.id` set to the Better Auth user id — precisely the
relationship Firebase has today, so the app's data model does not change.
`public.user.id` is already `text`, so no column type changes.

There is deliberately no FK from `auth_user` to `user`: deleting an identity
leaves the app user row and therefore leaves authorship on existing posts
intact, which is today's behaviour.

**Known cost, accepted:** Firebase verified an ID token's signature locally,
so authentication touched no database. `auth.api.getSession` reads the session
row, so every authenticated request now costs one indexed lookup — once per
tRPC *batch*, not per procedure, since the client uses `httpBatchLink`. That
is the right trade for deleting a vendor. If it ever matters, Better Auth's
`jwt` plugin restores stateless verification without changing any call site;
noted here so the option is not rediscovered under load.

### Cookies are impossible in the drawer — measured

The drawer renders the board in an iframe on a customer's domain, and sign-in
is reachable there (`sign-up-in/dialog.tsx` opens from `upvote-button`,
`comment-form`, `feedback-form`). A two-site harness probed a cross-site frame
in Chrome at default settings:

| Probe | Result |
|---|---|
| `document.cookie`, `SameSite=Lax` | **BLOCKED** — cannot be set |
| `document.cookie`, `SameSite=None` | **BLOCKED** |
| `navigator.cookieEnabled` | `true` — reports the opposite of the truth |
| `localStorage` / `sessionStorage` / `indexedDB` | work |

Storage is **partitioned per embedding site** but **persists within a
partition**. Cookie sessions in the drawer are not degraded — they are
impossible, and `navigator.cookieEnabled` actively lies about it.

### Proven end-to-end, both sign-in paths

better-auth **1.7.4**, a real browser, board framed by a different site using
**the widget's exact `sandbox` attribute** (`allow-scripts allow-same-origin
allow-forms allow-popups allow-popups-to-escape-sandbox`). `allow-same-origin`
preserves the frame's origin and therefore its storage: it is load-bearing for
auth, not incidental, and is recorded as such in `OverlayWidget.tsx`.

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
`HttpOnly`, so an empty `document.cookie` proves nothing — the suite could
have been passing on a cookie JavaScript cannot see. Destroying the token and
watching the session die with it proves the bearer token carries it.

**Social sign-in**

OAuth cannot redirect inside the frame (providers send `X-Frame-Options:
DENY`), so it uses a popup. Better Auth 1.7.4 ships `oauthPopup` /
`oauthPopupClient` for exactly this, documented as attaching "the popup token
as a bearer header **when embedded (where the cookie is partitioned)**".
Tested against a genuinely cross-site identity provider with a real click:

| # | Check | Result |
|---|---|---|
| 8 | `signIn.popup` from inside the frame | `success: true` |
| 9 | Protected endpoint with the popup token | **200** |
| 10 | Reload | session persists |
| 11 | **Clear the token** | **401** — again, no hidden cookie |
| 12 | `localStorage` throws | plugin returns `POPUP_SIGN_IN_FAILED` |

**Check 12 is a measured limitation with a proven fix.** The plugin persists
its token to `localStorage` and gives up if that throws. But the completion
handoff is a `postMessage` on an exported contract
(`better-auth:oauth-popup`, gated on origin and nonce) and every listener
receives it. Adding our own listener that captures the token into a
memory-backed store was tested under the same forced-throw conditions: the
plugin still reported `POPUP_SIGN_IN_FAILED`, **our fallback carried the
session and the protected call returned 200**. The app's token store — not the
plugin's — is the source of truth, and it degrades `localStorage → memory`.

### Account linking — deliberately off

`requireEmailVerification` is `false` (there is no mandatory email
infrastructure), which makes automatic linking-by-email an **account-takeover
vector**: someone could register a password account on an address they do not
own, and auto-linking would hand them the real owner's account when that owner
later signs in with Google.

So automatic linking is **disabled**. A second method on an existing email is
refused with "this email is already registered — sign in with your existing
method, then connect Google from account settings", and linking is only
possible from an authenticated session. This matches Firebase's current
behaviour (`auth/account-exists-with-different-credential`), so it is parity,
not a regression.

Microsoft requires an Entra tenant id (`MICROSOFT_TENANT_ID`, default
`common`) alongside client id and secret.

### Password reset — a deliberate product decision

Reset works today with **zero configuration** because Firebase sends the mail.
Deleting Firebase removes that, so this is called out as a decision rather
than allowed to become a silent regression. Three tiers, so **no deployment is
ever without a reset path and none requires SMTP**:

1. **`SMTP_URL` configured** → ordinary self-service email reset. The hosted
   platform sets this.
2. **No SMTP** → an admin generates a one-time reset link from the Admins page
   and delivers it however they like. This reuses the app's existing idiom:
   `createAdminInvite` already returns a copyable `inviteLink` instead of
   sending email.
3. **First-admin lockout** → `docker compose exec app node scripts/reset-password.mjs <email>`
   prints a one-time link.

Tiers 2 and 3 need no separate token machinery: Better Auth's
`requestPasswordReset` hands the reset URL to a `sendResetPassword` callback,
so with no SMTP configured that callback **returns the URL to the caller
instead of mailing it**. One code path, one token lifetime, one expiry rule
across all three tiers.

### Brute-force protection, and the proxy trap behind it

Better Auth's rate limiting defaults to **`enabled` only in production** and
**`storage: "memory"`**, and keys on the client IP. Two consequences, both
production-relevant:

- Memory storage is lost on every container restart and is not shared between
  replicas, so limits are far weaker than they appear. `storage: "database"`
  puts them in the Postgres we already require.
- **The proxy trap:** behind Caddy every request arrives from the proxy's
  address unless `advanced.ipAddress.headers` is configured. Auth rate
  limiting would then key *every user in the world to one bucket* — so one
  attacker brute-forcing a single account locks out sign-in for everyone. A
  security control that becomes a self-inflicted denial of service.

So `rateLimit: { enabled: true, storage: "database" }` always, and
`advanced.ipAddress.headers` is set to `["x-forwarded-for"]` **only when
`TRUST_PROXY=true`** — trusting that header without a proxy in front lets a
client spoof its way around the limit entirely. The same flag already governs
`getClientIp` for the app's own LLM rate limits, so there is one switch, not
two.

Password policy is Better Auth's default minimum of 8 characters, stated here
so it is a decision rather than an accident.

### Proxy trust

`advanced.trustedProxyHeaders` and `baseURL.allowedHosts` are gated on
`TRUST_PROXY=true`, default **false**. Enabled when not actually behind a
trusted proxy, a forged `x-forwarded-host` could steer the resolved auth base
URL. The Caddy compose files set it; the bare single-container quick start
does not. `TRUST_PROXY` also governs whether `getClientIp` trusts
`x-forwarded-for` for rate limiting.

### Multi-tenant origins

Each tenant board is its own origin, which Better Auth supports natively:

```ts
baseURL: {
  allowedHosts: [ROOT_DOMAIN, `*.${ROOT_DOMAIN}`],
  fallback: `https://${ROOT_DOMAIN}`,
  protocol: "https",
},
trustedOrigins: [`https://${ROOT_DOMAIN}`, `https://*.${ROOT_DOMAIN}`],
```

Wildcard patterns are supported by `matchesOriginPattern`. In single-tenant
mode `APP_URL` pins the origin when set; unset, it is inferred from the
request, which is what makes zero-config `docker compose up` work.

**Bearer tokens are stored per-origin, so a session does not *follow* a user
between tenant boards — but the token is not itself tenant-scoped.** The
session row is global; a token lifted from tenant A and replayed against
tenant B authenticates the same identity there. That is not a hole, because
every procedure authorises through `user_org` for the resolved `orgId`, so the
user still has no role on B. It is stated explicitly so nobody later mistakes
per-origin *storage* for a per-tenant *trust boundary* and drops an
authorisation check on that assumption.

### Social sign-in across many tenant origins

Google and Microsoft require **exact, pre-registered redirect URIs**. With a
board per subdomain the callback URL differs per tenant, and
`*.feedbackland.com/api/auth/callback/google` cannot be registered. Left
unsolved this would block social sign-in for every hosted tenant — the popup
mechanics proven above do not help, because the failure is at the provider's
registration check.

Better Auth ships `oAuthProxy` for exactly this. In multi-tenant mode a single
redirect URI is registered against `ROOT_DOMAIN`, and the plugin relays the
callback back to the tenant origin that started the flow, with an encrypted
payload and a short `maxAge` against replay. Single-tenant instances have one
origin and one redirect URI, so the plugin is not enabled there and a
self-hoster registers the obvious URL.

### Removed with Firebase

`firebaseConfig.ts`, both SDKs, the admin credentials, `FIREBASE_DATABASE_URL`
and the dead `adminDatabase` export — but only **after** the account migration
in §12 has run and been verified, since that migration needs a Firebase export
and the site stays live on Firebase until the cutover deploy.

The hardcoded `demo.feedbackland.com` branch in `hooks/use-auth.tsx`
auto-signs visitors in with **credentials committed in source**
(`admin@demo.com` / `demo1234`). The credentials leave the repository; the
behaviour does not, because that demo board is a live tenant and losing its
auto-sign-in is exactly the kind of change §12 forbids. It moves to
configuration (`DEMO_HOST` + a credential pair in environment).

### Session lifetime, sign-out, and the mirror call

Sessions are 30 days with a rolling `updateAge`, so the drawer does not log
people out mid-week; Firebase refreshed ID tokens transparently and the
replacement must not feel worse. Because tokens are bearer, **sign-out clears
the app's own token store as well as Better Auth's** — the popup plugin only
clears the key it owns, and a token left behind in our store would keep
authenticating tRPC calls after an apparent sign-out. This is an explicit
test case, not an implementation detail.

`upsertUser` runs immediately after sign-in and is now authenticated, so the
bearer token must be captured *before* it is called. The order is fixed:
capture token → store → `upsertUser` → session state.

**Server actions cannot see a bearer token.** A Next server action receives
cookies, not the `Authorization` header the tRPC client attaches — and inside
the drawer there is no usable cookie either. The codebase has exactly one
server-action file (`components/app/create-org-wizard/actions.ts`), and
`claimOrgAction` already works around this by taking an `idToken` in its input
and verifying it server-side. That constraint carries over unchanged: the new
`/setup` and `/signup` actions authorise with the **setup code** or an
explicitly passed token, never an ambient session, and **no board-surface
action may depend on one**. Anything needing the signed-in user goes through
tRPC or a route handler, both of which see headers.

### The generated secret must come from the entrypoint

`BETTER_AUTH_SECRET` is generated and persisted on first boot when unset, so
nobody runs `openssl rand`. But it **cannot be read from the database inside
the application**: `betterAuth({...})` is constructed synchronously at module
scope, long before any async database call could resolve.

So the container **entrypoint** owns it: it takes the advisory lock, runs
migrations, reads-or-creates the instance secret row, exports
`BETTER_AUTH_SECRET` into the environment, and only then `exec`s the server.
Module-scope construction stays synchronous and no call site becomes async.

Platforms with no entrypoint — Vercel — must set `BETTER_AUTH_SECRET`
themselves; the docs say so in the Vercel section, and the app fails fast with
a clear message rather than starting with an ephemeral secret that would
invalidate every session on restart.

## §4 — Image storage

Uploads move server-side: `POST /api/images` (size-capped, extension
allowlist, magic-byte validation via the `image-size` call already in
`processImagesInHTML`), bytes in Postgres, served by `GET /api/images/<id>`
with `Cache-Control: immutable` and an ETag. New URLs are **relative**, so
changing domain does not orphan stored images.

**Upload cannot require a session.** `feedback-form` calls
`processImagesInHTML(value)` *before* it checks `if (!session)`, so anonymous
visitors attach screenshots today — the board's "Submit Anonymously" path is a
real, shipped feature. Gating `/api/images` on auth would break it in a way
that only shows up for anonymous users with images.

So the endpoint is **unauthenticated but bounded**: the existing per-IP and
per-org rate limiter (already in front of the LLM endpoints) plus
`MAX_IMAGE_BYTES` and content validation. That is strictly tighter than
today's arrangement, which hands every visitor a public anon key with insert
rights on the whole bucket.

`GET` stays public — boards are public and the images render inside iframes on
third-party domains. Rows carry `orgId` so storage is attributable and an org
delete can cascade. Images referenced by no post or comment are swept by the
same opportunistic cleanup as the other unbounded tables (§5), since an upload
whose post is never submitted would otherwise live forever.

This keeps the container **stateless** — one `DATABASE_URL` is the whole
deployment — and retires the browser-held anon key and the public
`storage.objects` insert policy.

`MAX_IMAGE_BYTES` defaults to **4 MB**, deliberately under Vercel's 4.5 MB
request-body limit so the same default works on every host.

The cap applies to **decoded** bytes, not the base64 data URL the editor holds
in memory (base64 inflates by ~33%), and the client checks it before upload so
an oversized screenshot fails with a clear message instead of a 413.

### Legacy Supabase images: render every board image unoptimized

Post and comment bodies render images through **`next/image`**
(`components/ui/tiptap-output.tsx`), as do the org logo
(`platform-header/title.tsx`) and its settings preview
(`settings/logo.tsx`). `next.config.ts` allows exactly one remote host,
interpolated from `NEXT_PUBLIC_SUPABASE_PROJECT_ID` — so dropping that
variable turns the pattern into `undefined.supabase.co` and **every
pre-existing image 400s**.

An earlier revision of this document proposed a `LEGACY_IMAGE_HOSTNAME`
config value to keep that remote pattern alive. That was redundant: all three
call sites render *user-uploaded content*, and `unoptimized` makes Next emit a
plain `<img>` with the original `src`, bypassing `/_next/image` and therefore
the `remotePatterns` check entirely.

So `images.remotePatterns` is **replaced by `images: { unoptimized: true }`**
in `next.config.ts` — set globally rather than per component. Three call sites
each needing a prop is three chances to miss one, and a missed one fails only
for users whose posts contain a legacy image. One config line cannot be
partially applied.

It also means Next never invokes the image optimizer, so **`sharp` can be
dropped from the runtime image** — the Dockerfile includes it only if a build
warning shows it is still required. Legacy Supabase URLs keep resolving because
nothing validates them any more; new relative `/api/images/:id` URLs work for
the same reason; and the optimizer no longer round-trips into our own route or
fill a cache that a stateless container discards on restart. The stored HTML
already carries `width`/`height`, so layout is unaffected.

The tradeoff is deliberate: user images are no longer resized or converted to
WebP. For screenshot-sized attachments behind an immutable cache header that
is the right trade against a config knob, an SSRF-adjacent allowlist, and a
whole class of "image silently 400s" bugs.

## §5 — Schema and migrations

`db/schema.sql` is a Supabase dump: it references `"extensions"."halfvec"` and
its last two statements write to `storage.buckets` / `storage.objects`, which
do not exist on stock Postgres. The two files in `db/migrations/` are
hand-pasted SQL, and `CREATE TYPE … AS ENUM` is not idempotent.

Target: an ordered, tracked, idempotent set run by a Kysely `Migrator`.

```
0001_init.sql        base schema, vanilla-Postgres clean
0002_insights.sql    existing file, renamed
0003_security.sql    existing file, renamed
0004_images.sql      §4 image storage
0005_fk_fixes.sql    comment.authorId ON DELETE CASCADE
0006_instance.sql    instance config (generated auth secret, setup token)
```

`0001_init.sql` opens with

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

so the **same DDL runs on stock Postgres and on Supabase**, leaving the
existing `extensions.halfvec` column types alone.

### pgvector must also be reachable at *runtime*, not just in DDL

Putting the extension in `extensions` is what makes one DDL work everywhere —
and on its own it **silently breaks semantic search on every fresh
self-hosted install**. The DDL survives because it schema-qualifies everything
(`"extensions"."halfvec"`, `"extensions"."halfvec_cosine_ops"`). Runtime
queries do not: `pgvector/kysely`'s `cosineDistance()` emits a bare operator,

```sql
"feedback"."embedding" <=> $1
```

and `<=>` is resolved through `search_path`. Supabase works today because it
puts `extensions` on the search path for its roles. Stock Postgres defaults to
`"$user", public`, so the operator is invisible and the query fails with
`operator does not exist`.

The failure mode is nastier than a clean break: **inserts keep working**,
because an unknown literal coerces to the target column's type without any
search-path lookup. Embeddings would be written correctly and only *searching*
would fail — on a fresh install, with a cryptic error, long after setup
appeared to succeed.

`db/db.ts` currently constructs `new Pool({ connectionString })` with no
search-path configuration at all.

**The obvious fix is wrong**, and wrong specifically in production. Setting it
per connection —

```ts
pool.on("connect", (c) => c.query("SET search_path TO public, extensions")); // NO
```

— works on Docker, where the app talks to Postgres directly, and **fails
intermittently on Vercel**, which talks to a transaction-mode pooler. In
transaction pooling a `SET` outside a transaction lands on whichever server
connection happens to be assigned, does not persist once that connection
returns to the pool, and can leak into an unrelated client's session. Passing
`options=-c search_path=…` in the connection string is not a way out either:
PgBouncer rejects the `options` startup parameter outright.

The fix has to be a **server-side default**, applied by Postgres when the
backend session starts, so it holds no matter which pooled connection serves a
query. Migration `0001` sets it with `ALTER ROLE CURRENT_USER IN DATABASE
CURRENT_DATABASE() SET search_path = …`, and a role may alter its own settings
without superuser, so this works on managed Postgres as well as the bundled
container.

**It must append, not replace.** Production is Supabase, where the connecting
role is `postgres` — a role Supabase's own tooling also uses, and whose
`search_path` already contains more than `public`. Overwriting it with a flat
`public, extensions` would be a destructive edit to a shared role in someone
else's managed environment. So the migration reads the extension's actual
schema from `pg_extension`, checks whether it is already reachable, and only
then appends it to the role's existing `search_path`. On Supabase that is
typically a no-op, which is the correct outcome: production already works and
the migration must not "fix" it into something different. If a provider forbids even that,
the bulletproof fallback is to stop depending on `search_path` at all by
schema-qualifying the operator — `OPERATOR(extensions.<=>)` in a local helper
replacing `pgvector/kysely`'s `cosineDistance` — which is immune to pooling,
roles and privileges alike. That is the documented escape hatch, not the
default, because it means owning a query helper.

Verification 6 exercises a real search against a stock `pgvector/pgvector`
container **and** against a pooled connection, not just an insert: an
insert-only test passes while the feature is broken, and a direct-connection
test passes while production is broken. Enums are wrapped in
`DO … EXCEPTION WHEN duplicate_object`; the Supabase storage statements move
to a cloud-only file.

`0005_fk_fixes.sql` exists because `comment_authorId_fkey` is the **only one
of the five user foreign keys without `ON DELETE CASCADE`**, so deleting a
user currently fails. Better Auth adds real account-deletion flows, which
would hit this immediately.

**Boot sequence**, run by the container entrypoint inside one
`pg_advisory_lock` so concurrent container starts serialise instead of racing:

```
client = await pool.connect()          // a dedicated session, not the pool
  pg_advisory_lock(<constant>)         // session-scoped: released if we crash
    → db/migrations/*.sql via Kysely Migrator (tracked in schema_migrations)
    → getMigrations(auth.options).runMigrations()      [auth_* only]
    → ensure instance secret + setup code rows
  pg_advisory_unlock
client.release()
```

The lock must be taken on a **dedicated client checked out of the pool**, not
through the pool itself: `pg_advisory_lock` is session-scoped, and a pooled
query could take the lock on one connection and release it on another. Holding
one session also means a crashed migration releases the lock automatically on
disconnect rather than wedging every future boot.

**Migrations must use a direct connection, never a transaction pooler.** The
same session-scoping that makes the advisory lock work makes it unsafe through
PgBouncer or Supavisor in transaction mode, where the lock can be acquired on
one backend and released on another — silently, with no error. So there are
two connection strings in any pooled deployment:

| | Runtime | Migrations |
|---|---|---|
| Vercel + Supabase (production) | `DATABASE_URL` — Supabase **transaction pooler**, `:6543`, because serverless opens many short-lived connections | `DIRECT_DATABASE_URL` — Supabase **session mode**, `:5432` |
| Docker | `DATABASE_URL` — direct; there is no pooler | falls back to `DATABASE_URL` |

`DIRECT_DATABASE_URL` is optional and defaults to `DATABASE_URL`, so the
self-hosted path stays a single value while production gets the split it
needs.

Ordering matters: the SQL migrations own the application schema, Better Auth
owns `auth_*`, and neither creates the other's tables. The spike verified
`runMigrations()` works programmatically at boot and is idempotent across
restarts.

**Vercel runs the same sequence from the build command, not an entrypoint** —
there isn't one. `"build": "node scripts/migrate.mjs && npm run build -w feedbackland-react && next build"`,
using `DIRECT_DATABASE_URL`.

Two guards matter there and neither is optional:

- **Preview deployments must not migrate the production database.** Every
  branch and pull request triggers a build, and by default those builds share
  the project's environment variables. The migration step runs only when
  `VERCEL_ENV === "production"`, otherwise a preview of a half-finished branch
  rewrites the live schema.
- **Concurrent production builds** are serialised by the same advisory lock as
  container boots, which is why the lock is specified on the migration path
  rather than in the Docker entrypoint.

The generated-secret step is the one part that cannot run here: `BETTER_AUTH_SECRET`
must be a Vercel environment variable (§3), and the app fails fast if it is
missing rather than minting an ephemeral one that would invalidate every
session on the next deploy.

**`db/schema.ts` is generated, and regenerating it is a required step.** It
comes from `npm run kysely-codegen` against a live database, so adding
`images`, `auth_*` and the instance table means regenerating and committing it
— there is a chicken-and-egg here (the types the app compiles against come
from a database the migrations must create first), so the order is: migrate a
local Postgres, regenerate, commit. The current file also carries
Supabase-internal schemas (`realtime.*`, `storage.*`, `auth.*`) that will
vanish when it is regenerated against stock Postgres. That is intended and
safe — `db/schema.ts` is the only file that references them, which was
checked, not assumed.

**Housekeeping.** Three tables grow without bound and a container has no cron:
the app's `rate_limit`, Better Auth's `auth_verification` (reset and
verification tokens), and `auth_session` (expired sessions). `checkRateLimit`
already writes on every call, so it opportunistically deletes rows whose
window closed long ago — bounded work on a path that is already writing. The
two `auth_*` tables are pruned by the same opportunistic sweep, keyed off
`expiresAt`, rather than by adding a scheduler to a stateless container.

## §6 — AI is optional

Creating a post makes three LLM calls inline and throws if any fail: with no
key, `isInappropriateCheck` finds no content, returns `true`, and the post is
rejected as inappropriate. Search is purely vector-based, so with no
embeddings it returns nothing. A keyless instance today is not degraded — it
is broken.

### "Unavailable" is not "inappropriate"

There is a live bug here that the keyless work must fix, and it is worse than
the missing-key case. `isInappropriateCheck` ends with:

```ts
const content = data?.choices?.[0]?.message?.content;
if (!content) return true;          // ← any provider failure reads as "inappropriate"
```

Every non-answer from the provider — an expired key, an exhausted balance, a
429, a model outage, a network blip — returns `true`, and
`createFeedbackPostQuery` turns that into `throw new Error("inappropriate-content")`.
**So an OpenRouter key that runs out of credit silently rejects every post and
comment on the board, telling authors their feedback is inappropriate.** On a
feedback product that is close to the worst possible failure: it looks like
censorship, it is invisible to the operator, and nothing in the UI hints at
billing.

The fix is the same distinction the whole section is built on. Moderation has
three outcomes, not two: *allowed*, *refused*, and **unavailable**. Unavailable
degrades to the keyless path — the post is accepted without AI moderation,
titling or embedding — exactly as if no key were configured, and the failure is
logged for the operator rather than shown to the author. A moderation service
that cannot be reached must never be able to silently become a content ban.

The capability flag is **runtime**, surfaced on the existing `getOrg` payload
(already fetched globally by `useOrg`). It is not simply `!!OPENROUTER_API_KEY`
— a local model needs no key:

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
distance, so the `ILIKE` branch applies `searchValue` as a filter and then
takes the ordinary `orderBy` (`newest` / `upvotes` / `comments`) path
unchanged. Mixing the two would produce a cursor referencing a column that is
never selected — a silently broken "load more".

`LLM_BASE_URL`, `LLM_MODEL` and `LLM_EMBEDDING_MODEL` make the four hard-coded
OpenRouter URLs configurable (Ollama, LM Studio, vLLM). The OpenRouter-specific
`reasoning` parameter is omitted when the base URL is overridden.

### Optional, but actively encouraged

Optional must not mean hidden. A keyless instance is fully usable, and it is
also missing the feature the product leads with, so the admin area shows a
single dismissible card stating what a key unlocks (insights, Ask-AI, semantic
search, auto-titling), that it costs cents for a small board, and that a local
model via `LLM_BASE_URL` works too. It appears only for admins, never on the
public board, and never as a nag on the posting path — the one place where an
upsell would be actively hostile to the person giving feedback.

**Adding a key later needs a backfill.** Posts created while keyless have
`embedding = null` and would stay invisible to semantic search forever.
`docker compose exec app node scripts/backfill-embeddings.mjs` embeds every
row with a null vector, and the AI section of the docs points at it.

## §7 — Packaging

There are two first-class targets, and neither is a footnote:

- **Vercel** hosts the production multi-tenant platform at
  `<tenant>.feedbackland.com`, as it does today.
- **Docker** is what a self-hoster runs, single tenant, and is the flow
  everything else is optimised around.

One codebase and one application behaviour; only *packaging* differs. That
distinction matters — it is not the two-build-profile design this supersedes,
because no application code branches on the target.

### `output: "standalone"` must be conditional

Standalone output is for self-hosted and Docker deployments. Vercel builds
through its own pipeline, and setting `output: "standalone"` there is at best
ignored and at worst breaks the deployment — it is a documented cause of
builds that succeed and then fail to serve. So:

```ts
output: process.env.BUILD_TARGET === "docker" ? "standalone" : undefined,
```

The Dockerfile sets `BUILD_TARGET=docker`; Vercel sets nothing. This is a
packaging switch with no effect on application behaviour, which is why it does
not reintroduce the profile split.

### The image

Multi-stage, non-root, published to GHCR by CI on tag. No `sharp` unless the
build asks for it (§4 turns image optimization off entirely).

**The build stage must install dev dependencies and build the workspace.**
`components/app/widget-docs/index.tsx` imports `FeedbackButton` from
`feedbackland-react`, and the root build is
`npm run build -w feedbackland-react && next build`. A conventional
`npm ci --omit=dev` runner shortcut breaks the build outright. The widget's
own build runs `tsc -b` + vite under `typescript@7`, which relies on the
`@typescript/typescript6` fallback (see `scripts/eslint-ts6-resolver.cjs` and
project notes) — so that dev dependency must be present in the build stage.
The runner stage then copies only `.next/standalone`, `.next/static` and
`public`.

`next/font/google` downloads at build time, so the build stage needs network;
the runtime does not.

**The image must be multi-architecture.** A large share of self-hosters
develop on Apple Silicon, and an `amd64`-only image either refuses to run or
crawls under emulation — a first impression of "this is slow and broken" for
the audience this whole design is optimised for. CI publishes
`linux/amd64` **and** `linux/arm64`; `pgvector/pgvector` is already multi-arch,
so the compose file works unmodified on both.

### Health

`GET /api/health` returns 200 when the database answers, 503 otherwise. The
compose `app` service declares a healthcheck against it so orchestrators and
`depends_on` work.

### Bring-your-own Postgres needs pgvector

The bundled `pgvector/pgvector` image has the extension; a self-hoster pointing
`DATABASE_URL` at an existing Postgres may not. `CREATE EXTENSION vector` then
fails, and the failure must read as a prerequisite rather than a crash: the
migration aborts with a message naming the extension, the server it connected
to, and the two ways forward (install pgvector, or use the bundled compose).

Making pgvector *optional* was considered — embeddings are only written when
an LLM is configured, so a keyless instance never reads a vector. It was
rejected because the columns and HNSW indexes are in the base schema, and
making the DDL conditional would fork the schema between installs for the
benefit of a shrinking minority: pgvector is available on RDS, Cloud SQL, Neon,
Supabase and every mainstream managed Postgres. The requirement is documented
rather than engineered around.

### Recipe 1 — self-host, single tenant (the documented default)

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

The database port is deliberately **not published** — the password is only
reachable on the compose network. The docs state plainly that anyone
publishing 5432 must change it first.

### Recipe 2 — add a domain

Adds Caddy and sets `DOMAIN` and `TRUST_PROXY=true`; TLS is automatic. Not
optional in practice: host pages are HTTPS, so an HTTP board in an iframe is
blocked as mixed content. Documented prominently, not as a footnote.

Two long-lived responses need the proxy to stay out of the way, and both fail
silently if it does not:

- **Insight generation** batches a whole board through the model and carries
  `maxDuration = 300` — a setting that means nothing outside Vercel. The Caddy
  block sets an explicit long `reverse_proxy` read timeout for that route, or
  a five-minute run surfaces as a truncated response with no error anywhere.
- **Ask-AI streams.** `app/api/chat/route.ts` returns
  `result.toUIMessageStreamResponse()`, a token-by-token stream. Caddy does
  not buffer by default and flushes `text/event-stream` immediately, but the
  config states `flush_interval -1` for that route explicitly rather than
  relying on content-type sniffing — the failure mode is an answer that
  arrives all at once after a long pause, which reads as "the AI is broken"
  rather than as a proxy setting.

### Recipe 3 — multi-tenant on Vercel (this is production)

`feedbackland.com` stays on **Vercel**, with **Supabase** remaining the
Postgres. Neither changes. Host-based tenancy (§1) is what makes this work
unchanged: a wildcard domain `*.feedbackland.com` added to the project routes
every tenant to the same deployment, and Vercel issues a certificate per
subdomain automatically. Nothing in the application knows it is on Vercel.

What *does* change for production is narrower than it first appears. Supabase
keeps serving the database and keeps hosting the existing image bucket, whose
URLs stay valid (§4); what is retired is Supabase **Auth-adjacent usage** — the
browser-held anon key and the public bucket insert policy — and Firebase. The
Supabase project itself is not going anywhere, which is why the two connection
strings below are its pooled and direct URLs rather than a migration.

Four platform facts this depends on, each verified rather than assumed:

| Fact | Consequence for this design |
|---|---|
| Wildcard domains require the domain's **nameservers to be Vercel's** (certs are issued via DNS-01) | A one-time DNS setup, already true for the live deployment. The only production-side lock-in, and it is DNS, not code |
| Serverless request bodies are capped at **4.5 MB** | `MAX_IMAGE_BYTES` defaults to 4 MB so one value is safe on every host (§4) |
| `maxDuration` is 300 s on Hobby and 800 s on Pro **with Fluid compute**, which is the default for new projects | The existing `maxDuration = 300` on the tRPC route is within range; insights do not need re-architecting |
| Each function instance opens its own connections | Runtime uses the **pooled** `DATABASE_URL`; migrations use `DIRECT_DATABASE_URL` (§5) |

Streaming (Ask-AI) and `headers()` work natively, and `images.unoptimized`
(§4) additionally takes the platform's image-optimization billing out of the
picture.

The one thing Vercel cannot do is run an entrypoint, which is why migrations
and the generated secret are handled as described in §5 and §3.

### Recipe 4 — multi-tenant self-hosted (optional, advanced)

Explicitly the lowest-priority path: self-hosters overwhelmingly want one
board, and production multi-tenancy is Vercel's job above. It is documented
because it falls out of host-based tenancy almost for free, and it is kept out
of the critical path so its complexity never lands on a single-tenant user.

Set `ROOT_DOMAIN`, point wildcard DNS at the host, and let Caddy issue
**per-tenant certificates on demand** — no wildcard certificate and no
DNS-provider API token:

```
:443 {
  tls {
    on_demand
  }
}
```

with `on_demand_tls { ask http://app:3000/api/tls-check }` plus Caddy's
`interval`/`burst` issuance limits.

**`GET /api/tls-check?domain=` is a specified endpoint, not a detail.** It
returns 200 for exactly three things, and getting the list wrong breaks
production in ways that are hard to trace back:

1. `ROOT_DOMAIN` and `www.ROOT_DOMAIN`.
2. A `<label>.ROOT_DOMAIN` whose label resolves to an existing org —
   **including uuid labels**, or the widget's default
   `<orgId>.feedbackland.com` board entry point never gets a certificate.
3. **Service hosts the deployment actually serves, `api.ROOT_DOMAIN` first
   among them.** `api` is a *reserved* label, so it resolves to no org and a
   naive "must map to a tenant" rule would 404 it — denying a certificate to
   `api.feedbackland.com`, which is the hard-coded `DEFAULT_API_ENDPOINT` in
   the published widget. Every hosted customer's popover submissions would
   fail, from a TLS error with no obvious connection to a feedback form.

Everything else gets 404. It answers from the
same memoised tenant cache as §1, **with negative results cached**, so
handshake probing of random subdomains cannot turn into one database query per
packet; Caddy's rate limits are the backstop behind that.

It is reachable **only on the internal compose network** (Caddy calls
`http://app:3000/api/tls-check`) and is blocked at the proxy for external
requests. It is a yes/no oracle for "does this tenant exist", and while tenant
slugs are semi-public by nature — they are URLs — there is no reason to publish
an enumeration endpoint for them.

### A cost note on images, stated rather than buried

Today images are served from Supabase Storage's CDN, free of the application.
After §4 they come from Postgres through `/api/images/:id`, which on Vercel is
a function invocation plus database egress on every cache miss. The immutable
cache header means the edge absorbs the steady state, so this is acceptable —
but it is a real change in the production cost shape, and it is the strongest
argument for the S3-compatible adapter that §4 lists as additive. Keeping
Supabase Storage for production only was rejected deliberately: it would mean
the hosted product and the self-hosted product no longer run the same code,
which is the thing this whole design exists to avoid.

## §8 — First run

**Single tenant.** No claimed org → `/setup` → one form (product name, your
name, email, password) → creates the org, the identity, the `user` row, the
admin `user_org` row, and claims it → redirect to `/`, signed in. Afterwards
`/setup` redirects to `/`.

**Multi tenant.** Root domain `/` → `/signup` → the same underlying "create
org + first admin" path → redirect to `<slug>.<ROOT_DOMAIN>`.

### Setup cannot be hijacked

An instance reachable on the internet before it is claimed would otherwise
grant admin to whoever loads `/setup` first.

`/setup` therefore **always** requires a one-time **setup code**, generated on
first boot, stored in the instance-config table, and cleared once an org is
claimed.

An earlier revision made the code conditional on the request coming from a
loopback or private address. **That is not implementable**: `NextRequest` in
Next 16 exposes no socket remote address (`request.ip` was Vercel-only and is
gone), so the only available signal is `x-forwarded-for` — a client-supplied
header, and precisely the thing that must not be trusted for an authorisation
decision. A rule that degrades to "trust a spoofable header" is worse than no
rule.

The cost is one line, and the quick start is arranged so it is not even that:
it runs `docker compose up` in the foreground, and the code is printed in the
startup banner in the terminal the operator is already watching.
`docker compose logs app | grep "Setup code"` is documented for the detached
case.

Before any org exists, `resolveOrg` returns null and every org-scoped
procedure would fail its `publicProcedure` guard. The redirect to `/setup`
therefore happens in the server component **before** the board renders, and
`/setup` lives outside the `(board)` route group so none of the board's
org-scoped queries ever mount. A pre-setup visit never issues a query that
cannot succeed.

### Promoting single-tenant to multi-tenant

Setting `ROOT_DOMAIN` on an instance that already has one org promotes it
rather than breaking it: the org keeps its slug and its board moves to
`<slug>.<ROOT_DOMAIN>`. The subdomain field in settings — hidden in
single-tenant mode — becomes visible so a default slug can be renamed. The
docs state that the old URL must be redirected and the widget snippet updated,
since `platformId` still resolves but the board URL changes.

## §9 — The widget needs no changes

`feedbackland-react` already accepts `url` and `platformId` together:
`resolvePlatformUrls` uses `url` for the iframe and
`${origin}/api/feedback/create` for submissions, and `PopoverWidget` sends
`orgId: platformId`. A self-hosted snippet is therefore

```tsx
<FeedbackButton url="https://feedback.example.com" platformId="<org uuid>" />
```

against the package as published. `/api/feedback/create` resolves the org from
`Host` and **falls back to the body's `orgId`**, which keeps the
`api.feedbackland.com` entry point (whose host carries no tenant) working. No
npm release is part of this work.

## §10 — Runtime configuration reaching the client

Three UI decisions depend on how the instance is configured, and none of them
can be a build-time constant in a prebuilt image:

- whether AI surfaces are shown (`hasLLM`, §6);
- whether the org **subdomain** field and signup funnel appear at all
  (single vs multi tenant);
- whether the admin Widget snippet includes a `url` prop — single-tenant must,
  because there is no `<uuid>.<root>` to resolve; hosted multi-tenant omits it.

Today this is decided by `getIsSelfHosted()` / `useIsSelfHosted()` reading
`SELF_HOSTED` and `NEXT_PUBLIC_SELF_HOSTED`. Both are **deleted**, along with
the env vars: "self-hosted" is no longer a property of the build, and the
question the UI actually wants to ask is "is this instance multi-tenant",
which is a *runtime* fact derived from `ROOT_DOMAIN`.

So the existing `getOrg` payload carries a small `instance` object —
`{ hasLLM, isMultiTenant, rootDomain? }` — and `useIsSelfHosted` is replaced
by `useInstance()`. `getOrg` is already fetched globally by `useOrg`, so this
adds no round trip. `NEXT_PUBLIC_*` stays empty for a prebuilt image, which is
the constraint that makes one published artefact possible at all.

## Environment reference

Nothing below is required for `docker compose up` to work.

| Variable | Default | Effect |
|---|---|---|
| `DATABASE_URL` | set by compose | **The only hard dependency.** Pooled, where a pooler exists |
| `DIRECT_DATABASE_URL` | `DATABASE_URL` | Session-mode URL for migrations; required wherever `DATABASE_URL` is a transaction pooler (§5) |
| `BUILD_TARGET` | unset | `docker` selects `output: "standalone"`; build-time only |
| `ROOT_DOMAIN` | unset | Set ⇒ multi-tenant at `*.ROOT_DOMAIN`; unset ⇒ single tenant |
| `APP_URL` | inferred | Pins the public origin behind a proxy |
| `TRUST_PROXY` | `false` | Honour `x-forwarded-host`/`-proto`/`-for`; set by the Caddy recipes |
| `BETTER_AUTH_SECRET` | generated | Entrypoint generates and persists it; required manually where there is no entrypoint |
| `SMTP_URL` / `SMTP_FROM` | unset | Self-service password reset (tier 1) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | unset | Google sign-in |
| `MICROSOFT_CLIENT_ID` / `_SECRET` / `MICROSOFT_TENANT_ID` | unset / `common` | Microsoft sign-in |
| `OPENROUTER_API_KEY` | unset | AI features via OpenRouter |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_EMBEDDING_MODEL` | OpenRouter defaults | Any OpenAI-compatible endpoint; also enables AI without a key |
| `MAX_IMAGE_BYTES` | `4000000` | Upload cap, decoded bytes |
| `DEMO_HOST` + demo credentials | unset | Auto-sign-in for a public demo board; production-only, replaces credentials previously committed in source (§12) |
| `FIREBASE_SCRYPT_*` (signer key, salt separator, rounds, mem cost) | unset | Production-only, verifies migrated legacy password hashes (§12). Self-hosted installs never set these |

The last two rows are the only production-only variables in the table, and
both exist to keep existing tenants working rather than to run the product. A
self-hosted instance leaves every row blank except the one compose fills in.

**Deleted:** `SELF_HOSTED`, `NEXT_PUBLIC_SELF_HOSTED`,
`NEXT_PUBLIC_SUPABASE_PROJECT_ID`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
`FIREBASE_DATABASE_URL`, `VERCEL_URL` / `NEXT_PUBLIC_VERCEL_URL` usage.
Ten required values become one that compose supplies for you.

## §11 — Documentation

`SELFHOSTING.md` is rewritten around the happy path — `curl` a compose file,
`docker compose up`, create an admin — with everything currently mandatory
demoted to optional sections: domain + HTTPS, AI (and the embedding backfill),
social sign-in, SMTP and the reset tiers, backups, upgrades, running
multi-tenant, deploying on Vercel instead, env reference, troubleshooting.

## §12 — Cutting over the existing deployment

Existing tenants must not notice the change. Everything except identity is
already preserved by construction — same database, same `orgSubdomain`, so the
same board URLs; the widget contract is untouched (§9); posts, comments,
upvotes, insights, admin roles and in-flight admin invites are rows that are
never rewritten. Identity is the part that needs work, and it is the part that
would otherwise lock every user out.

### What a tenant would otherwise notice, and what is done about it

| Would change | Resolution |
|---|---|
| Accounts and passwords | Migrated with the uid preserved (below) |
| Google / Microsoft sign-in | Provider links imported, so the same button works |
| Being signed out | **Accepted.** One re-login, with the same credentials — unavoidable when the token issuer changes, and the only visible footprint |
| `/get-started` bookmarks | Permanent redirect to `/signup` |
| Ask-AI conversation history | Storage re-keyed from subdomain to org id, with a one-time read of the old key so history carries over |
| `<uuid>.feedbackland.com` redirecting to the slug | **Redirect preserved** — see below |
| Images | Legacy Supabase URLs keep resolving (§4); new uploads are relative |
| The public demo board | See below — this one is easy to miss |

**The demo tenant is a trap.** `hooks/use-auth.tsx` hard-codes
`demo.feedbackland.com` and auto-signs visitors in as `admin@demo.com`, and
the README links that board as the live demo. §3 deletes that block because
credentials do not belong in source — which would silently turn the public
demo into a signed-out board.

An earlier revision said the fix was "`DEMO_HOST` plus a credential pair in
environment". **That does not work as written**: the sign-in happens in the
browser, so client-readable credentials would mean a `NEXT_PUBLIC_` variable —
baked in at build time, which breaks the single published image, and still
shipping the password to every visitor.

The credentials stay **server-side** instead. `GET /api/demo-session` checks
the resolved host against `DEMO_HOST`, calls
`auth.api.signInEmail({ …, returnHeaders: true })` with server-only
credentials, and returns just the bearer token; the client stores it exactly
as it would after a normal sign-in. Verified: that call returns both a
`set-auth-token` header and `body.token`, and the token authenticates through
`auth.api.getSession`.

This is strictly better than today, where `admin@demo.com` / `demo1234` are
compiled into the client bundle for anyone to read. The demo board behaves
identically and the password never leaves the server.

**The uuid → slug redirect has to stay.** Host-based resolution can serve
`<orgId>.feedbackland.com` directly, which made the existing redirect look
redundant. It is not. The published widget builds
`https://<platformId>.feedbackland.com` and the popover renders "view all
feedback" links to that same origin, so dropping the redirect leaves a visitor
who follows one sitting on a raw-uuid hostname instead of `acme.feedbackland.com`
— a visible change to a tenant's own branded URL, which is precisely what this
section forbids.

So the canonical redirect stays, moved out of `proxy.ts` into the `(board)`
layout: when the host is a uuid label and the resolved org has a different
slug, redirect to the slug host preserving path and query. Inside the drawer
this is invisible, exactly as today.

### Migrating identity

1. `firebase auth:export users.json --format=json` together with the project's
   password hash parameters (`base64_signer_key`, `base64_salt_separator`,
   `rounds`, `mem_cost`).
2. `scripts/import-firebase-users.mjs` inserts `auth_user` rows **keeping the
   Firebase `localId` as the id**. This is the load-bearing detail: every
   `public.user.id`, `user_org.userId`, `feedback.authorId`, `comment.authorId`
   and `user_upvote.userId` already holds that value, so nothing is rewritten
   and no foreign key moves. `email`, `displayName`, `photoUrl` and
   `emailVerified` come across unchanged.
3. Passwords are stored on the `credential` account row
   (`auth_account.providerId = "credential"`, `accountId = userId`) in a
   tagged legacy format `firebase-scrypt$<salt>$<hash>`, and
   `emailAndPassword.password.verify` dispatches on the tag.

   **The custom `verify` must also handle modern hashes.** Its signature is
   `({ hash, password }) => Promise<boolean>` and supplying it *replaces*
   Better Auth's own verification entirely — so untagged hashes are delegated
   to `verifyPassword` from `better-auth/crypto`, which the package exports
   for exactly this. Overriding `hash` is deliberately **not** done: new and
   changed passwords then keep Better Auth's own format with no reimplementation
   of its hashing.

   Note also that `verify` receives no user id and no database handle, so
   transparent rehash-on-login cannot happen inside it. Leaving legacy hashes
   in place is safe — they are scrypt — at the cost of keeping the four
   parameters in environment. That is the accepted outcome; a separate sign-in
   hook can drain them later if desired.

4. Social users get `auth_account` rows with `providerId` `google` /
   `microsoft` and `accountId` taken from the export's `providerUserInfo`
   `rawId`. Better Auth matches on `(providerId, accountId)`, so the existing
   button signs the same person into the same account.

### This was verified, not reasoned about

The migration is the one step that cannot be fixed forward by redeploying, so
its mechanics were run rather than assumed — against better-auth 1.7.4:

| Check | Result |
|---|---|
| Our Firebase-SCRYPT implementation vs a published reference vector | **exact match** |
| Migrated user signs in with their **original** Firebase password | works, and `res.user.id` is the preserved Firebase uid |
| Wrong password | rejected |
| A brand-new user through the same custom `verify` | works, and its stored hash is in the **modern** format |
| Pre-seeded social link, then a real OAuth round trip | signs into the **existing** user — session bound to the Firebase uid, and **exactly one** `auth_user` row, no duplicate |

Three parameter details are worth stating because getting any of them wrong
fails silently for *every* user, and two are counter-intuitive:

- `N = 2^mem_cost`, `r = rounds`, `p = 1`, and the derived key length is
  **32 bytes**, not 64 — it is an AES-256 key, not a scrypt digest.
- The derived key encrypts the decoded `signer_key` with **AES-256-CTR and a
  16-byte zero IV**; the base64 of that ciphertext is the stored hash.
- `firebase auth:export` emits **standard** base64 (`+/`) while the Admin SDK's
  `listUsers` emits **URL-safe** base64 (`-_`). The decoder must accept both,
  or passwords fail depending only on which tool produced the export.
5. The script is **idempotent and rerunnable**, reports a per-user outcome, and
   refuses to run twice over the same user without `--force`. Firebase enforces
   one account per email, but the import still fails loudly on a duplicate
   rather than silently merging two people.

### Sequencing and rollback

The import runs against production **after** phase 1 has created `auth_*` and
**before** phase 4 removes Firebase verification, with the site still live on
Firebase throughout — it only writes new tables that nothing reads yet, so it
is safe to run, verify, and re-run. The cutover is then the ordinary phase 4
deploy.

Rollback is the same `pg_dump` boundary as phase 4: the import only adds
`auth_*` rows, so reverting the deployment restores Firebase auth against
untouched application tables.

Firebase credentials are removed from Vercel only once sign-in has been
confirmed against migrated accounts — email/password, Google and Microsoft
each verified with a real tenant account, not a freshly created one.

## Surfaces to change

Not exhaustive to the line, but every file below is *known* to need work, and
each was found by tracing an actual execution path rather than by guessing.

**New** — `lib/tenancy.ts`; `lib/auth/{server,client}.ts`;
`app/api/auth/[...all]/route.ts`; `app/api/images/route.ts` +
`app/api/images/[id]/route.ts`; `app/api/health/route.ts`;
`app/api/tls-check/route.ts`; `app/setup/`; `app/signup/`;
`scripts/{migrate,backfill-embeddings,reset-password,drawer-auth-check,import-firebase-users}.mjs`;
`db/migrations/000{1..6}_*.sql`; `Dockerfile`, `.dockerignore`,
`compose.yml`, `compose.tls.yml`, `Caddyfile`,
`.github/workflows/publish-image.yml`.

**Changed** — `next.config.ts` (standalone, `images.unoptimized`, `headers()`);
`db/db.ts` (`search_path`); `proxy.ts` (embed header only); `lib/trpc.ts`
(session + host tenancy); `lib/utils.ts` (URL helpers deleted);
`lib/utils-server.ts` (LLM base URL); `lib/schemas.ts` (`upsertUserSchema`);
`hooks/use-auth.tsx` (Better Auth, demo-login removal); `providers/trpc-client.tsx`
(token header, no `subdomain`); `app/api/user/upsert-user/route.ts` (authenticated);
`app/api/chat/route.ts` (**own inline auth + tenancy**);
`app/api/feedback/create/route.ts` (host + body fallback);
`queries/{get-feedback-post,get-comment,upvote-feedback-post,upvote-comment}.ts`
(**org scoping**); `queries/{create-feedback-post,create-comment,get-feedback-posts}.ts`
(LLM optional + `ILIKE`); `queries/check-rate-limit.ts` (pruning);
`trpc/{get-org,get-feedback-post,update-org,rewrite-feedback}.ts`;
`components/app/{widget-docs,settings/platform-url,create-org-wizard,forgot-password,sso,admins}/*`;
`components/app/ask-ai/storage.ts` (**re-key off org id, not subdomain**);
`db/schema.ts` (**regenerate**); `SELFHOSTING.md`; `README.md`; `.env.example`.

**Deleted** — `firebaseConfig.ts`; `lib/firebase/`; `lib/supabase.ts`;
`hooks/{use-subdomain,use-maindomain,use-vercel-url,use-is-self-hosted,use-sse}.ts`;
`providers/iframe.tsx` + `iframeParentAtom`; `app/api/org/[orgId]/`;
`app/get-started/`; `app/[orgSubdomain]/claim/`; `app/design-preview/`
(already empty).

## Delivery plan

Ordered so the riskiest unknowns fail first and each phase is independently
verifiable.

| # | Phase | Gate |
|---|---|---|
| 1 | Schema + migration runner with advisory lock; `auth_*` namespace; `0005_fk_fixes`; entrypoint owns secret + setup code | Fresh DB and an old Supabase-shaped DB both converge; concurrent boots serialise; a killed migration does not wedge the next boot |
| 2 | Dockerfile + compose + health endpoint | Image builds **including the widget workspace** and boots against Postgres |
| 3 | Host-based tenancy; delete `[orgSubdomain]`, subdir mode, `subdomain` header; **scope the four cross-tenant queries** | Single-tenant board at `/`; multi-tenant on `*.localhost`; a cross-org post/comment id is rejected on read *and* upvote |
| 3a | **Import production identities** (§12) — runs against live production while it is still on Firebase, writing only `auth_*` | Every Firebase user has an `auth_user` with the **same id**; social links present; rerunning changes nothing |
| 4 | Better Auth replaces Firebase; `upsert-user` authenticated; linking off; reset tiers; sign-out clears our store; demo auto-login moved to config | Sign-up/in/out on the standalone board; **a real migrated tenant account signs in with its existing password**; `upsert-user` rejects a forged `userId`; no token survives sign-out |
| 5 | **Drawer auth acceptance test** (verification 3) | Merge blocker |
| 6 | Postgres image storage; all board images `unoptimized`; drop `remotePatterns` | New uploads work; legacy Supabase images still render |
| 7 | AI optional + BYO endpoint + backfill script | Keyless instance fully usable, paging included |
| 8 | First-run `/setup` + setup code; `/signup`; remove claim wizard | Fresh volume → admin in one form; `/setup` refuses without the code |
| 9 | **Vercel production path**: conditional `standalone`, migrations in the build command with the `VERCEL_ENV` guard, pooled vs direct URLs, `oAuthProxy` | Preview project on a wildcard domain: two tenants, search through the pooler, social sign-in on a subdomain, preview builds do not migrate |
| 10 | Optional self-hosted multi-tenant: Caddy recipe + `tls-check`; docs rewrite | Per-tenant certs on demand; `tls-check` accepts uuid and `api.` labels |

**Migrations must stay backward compatible for one release.** On Vercel they
run in the build, *before* the new deployment serves traffic, so the previous
version briefly runs against the new schema; during a rollout both versions
are live at once. Every migration here is additive (new tables, a widened FK
rule, a role setting) and none drops or renames a column the previous release
reads — expand now, contract in a later release, never both in one deploy.

**Tenancy precedes auth deliberately.** An earlier ordering put auth first,
but phase 4's `upsert-user` fix derives the org from `Host`, which only exists
after phase 3 — auth-first would have meant building the fix against the
`subdomain` header that phase 3 deletes, then rewriting it.

**Rollback:** phases 1–3 are additive or code-only and revert by redeploying.
From **phase 4** the identity store changes, so the rollback unit becomes the
database: take a `pg_dump` immediately before phase 4 and restore it alongside
the previous image. Phases 5–9 are code-only again.

## Risks

| Risk | Mitigation |
|---|---|
| Auth fails in the drawer's cross-origin iframe | **Retired.** Both paths proven end-to-end, including the no-hidden-cookie check (§3) |
| Popup OAuth breaks where `localStorage` throws | **Measured and fixed**; own completion-message listener verified under forced-throw |
| Better Auth takes over `public.user` | **Retired.** `auth_*` renaming verified against a DB holding the real user table: `toBeAdded: (none)`, rows untouched |
| Legacy Supabase images 400 through `next/image` | All board images render `unoptimized`, so nothing validates their host; `remotePatterns` is deleted rather than reconfigured |
| Generated auth secret unreadable at module scope, or ephemeral on restart | Entrypoint resolves it before `exec`; platforms without an entrypoint must set it and the app fails fast if unset |
| A stale bearer token outlives sign-out | Sign-out clears the app's store as well as the plugin's; explicit test case |
| Widget `sandbox` loses `allow-same-origin` later | Recorded as load-bearing in `OverlayWidget.tsx`; asserted by the acceptance test |
| Auto-linking enables account takeover on unverified emails | Automatic linking **disabled**; linking only from an authenticated session |
| `/setup` hijacked on an exposed instance | Setup code always required; no reliance on a spoofable header to decide |
| Tenant isolation resting on unguessable ids rather than a predicate | Four unscoped queries fixed and tested with cross-org ids (§1); premise corrected rather than asserted |
| Existing tenants locked out at cutover | Identities imported with the Firebase uid preserved, so no FK moves; verified against real accounts across all three sign-in methods before Firebase credentials are removed (§12) |
| Deleting the demo auto-login silently breaks the public demo board | Behaviour preserved in configuration; credentials leave the repository, the experience does not (§12) |
| Legacy password hashes carried forever, keeping Firebase parameters in env | Acceptable and recorded as a choice: scrypt hashes stay valid, and a sign-in rehash drains them if implemented (§12) |
| A custom password `verify` silently breaks *new* passwords by replacing Better Auth's own | Untagged hashes delegate to `verifyPassword` from `better-auth/crypto`; proven by signing in a brand-new user through the same verify (§12) |
| Demo credentials shipped to the browser via `NEXT_PUBLIC_` | Server-only `/api/demo-session` mints a bearer token; the password never reaches the client, unlike today (§12) |
| Overwriting Supabase's shared `postgres` role `search_path` | Migration appends only when the extension's schema is not already reachable — a no-op on Supabase (§5) |
| `amd64`-only image is slow or unusable on Apple Silicon | CI publishes `linux/amd64` and `linux/arm64` (§7) |
| Forged `x-forwarded-host` steers auth URLs | `TRUST_PROXY` defaults false; `allowedHosts` bounds it |
| `tls-check` becomes a DoS or cert-exhaustion vector | Negative-cached lookups + Caddy issuance rate limits |
| Concurrent container boots race migrations | `pg_advisory_lock` around the whole sequence |
| `output: "standalone"` mis-traces `pg` or a native dep | Phase 2 builds and boots the image before anything depends on it |
| pgvector reachable in DDL but not at runtime | Server-side `ALTER ROLE … SET search_path`, **not** a per-connection `SET`, which a transaction pooler drops or leaks; verification searches for real, through a pooler (§5) |
| Advisory lock taken and released on different backends through a pooler | Migrations run on `DIRECT_DATABASE_URL` in session mode (§5) |
| A preview deployment migrates the production database | Migration step guarded on `VERCEL_ENV === "production"` (§5) |
| `output: "standalone"` breaks the Vercel deployment | Emitted only when `BUILD_TARGET=docker` (§7) |
| Auth rate limiting keyed to the proxy IP, locking out all users | `advanced.ipAddress.headers` set only under `TRUST_PROXY`; limits stored in the database (§3) |
| `/admin` clickjacked through an iframe | Per-route `frame-ancestors`; board stays `*`, admin and auth `'none'` (§2) |
| Images bloat Postgres | 4 MB cap; S3 remains additive |
| An exhausted or invalid LLM key rejects every post as "inappropriate" | Moderation gains a third outcome, *unavailable*, which degrades to the keyless path and is logged, never surfaced as a content ban (§6) |
| Serving images from Postgres changes production cost shape | Immutable edge caching absorbs the steady state; S3 adapter is the escape valve, and keeping Supabase for production only was rejected to preserve one codebase (§7) |

## Verification

1. `npm run typecheck` and `npx next build` clean. (`npm run lint` is known
   broken on Next 16 and is not a gate.)
2. **Single-tenant smoke from an empty volume** — the primary flow:
   `docker compose up` → `/setup` → post → comment → upvote → search → admin →
   widget snippet embeds and submits from another origin.
3. **Drawer auth acceptance test — merge blocker.** A page on a different site
   embedding the real widget; entirely inside the drawer: sign up, sign out,
   sign in; upvote and comment; reload and stay signed in; social sign-in via
   popup; then repeat with cookies blocked for the board origin, and again
   with `localStorage` forced to throw. Chrome and Firefox at minimum.
   **The spike harness is committed as `scripts/drawer-auth-check.mjs`** — the
   repo has no test runner, so an uncommitted manual procedure would rot.
4. **Tenant isolation**: with two orgs seeded, a post id and a comment id from
   org B are rejected when requested or upvoted while resolved to org A — all
   four queries from §1, read and write.
4a. **Existing tenants unchanged — the hard requirement (§12).** Against a
   restored copy of the production database plus a real Firebase export:
   a migrated user signs in with their **existing password**; a Google user and
   a Microsoft user each sign in through the same button; each lands on the
   same board with the **same admin role**, and their existing posts, comments
   and upvotes are still attributed to them; board URLs and an already-deployed
   widget snippet are byte-for-byte unchanged; `/get-started` redirects; a
   uuid host still lands on the slug; and the demo board still auto-signs in,
   with the credentials **absent from the client bundle**. Re-running the
   import changes nothing. This runs on a restored copy **before** it runs on
   production.
5. **Security regressions**, each an explicit test: `POST /api/user/upsert-user`
   with a forged `userId` is rejected and cannot rename another user; `/setup`
   without the setup code is rejected, and the code stops working once an org
   is claimed; a second sign-in method on an existing email does not
   auto-link; a bearer token captured before sign-out is rejected after it;
   `/admin` responds with `frame-ancestors 'none'` while the board responds
   with `*`; and repeated failed sign-ins from one address rate-limit **that
   address only**, with a second address still able to sign in — the
   assertion that catches the proxy-IP trap.
6. **Semantic search on stock Postgres.** Against the real
   `pgvector/pgvector` container — not Supabase — a post is created *and then
   found by a semantically-related query*. An insert-only check passes while
   search is broken, which is exactly the failure the `search_path`
   configuration prevents (§5).
7. **Multi-tenant**: two tenants behind the real Caddy config — each resolves
   its own board; certs issue on demand; `tls-check` rejects unknown hosts,
   accepts a uuid label, and accepts `api.ROOT_DOMAIN`; signing in on one
   tenant does not sign you in on the other; and **social sign-in completes on
   a tenant subdomain through `oAuthProxy` against a single registered
   redirect URI**.
8. **Keyless**: everything in 2 with no LLM configured; AI surfaces absent,
   posting and search still working, "load more" paging correctly under
   `ILIKE`.
8a. **Broken key, not absent key** — the case that is live today: configure an
   invalid or exhausted `OPENROUTER_API_KEY` and confirm a post is **accepted**
   without AI enrichment and the failure is logged, rather than rejected as
   `inappropriate-content`. Repeat for comments, and for a provider returning
   429 and 402.
9. **Local model**: `LLM_BASE_URL` at Ollama; post creation produces an AI
   title; then `backfill-embeddings` makes older keyless posts searchable.
10. **Upgrade**: boot against a database created by the old Supabase schema;
   migrations converge with no manual steps and legacy Supabase image URLs
   still render.
11. **Production on Vercel — a first-class gate, not a spot check.** Deploy the
   branch to a Vercel preview project with its own database: the build runs
   migrations against `DIRECT_DATABASE_URL` while the app runs on the pooled
   one; **semantic search works through the pooler** (the case a direct
   connection would hide); a wildcard domain resolves two tenants; social
   sign-in completes on a tenant subdomain; Ask-AI streams incrementally;
   insight generation completes inside `maxDuration`; an upload just under
   4 MB succeeds. Confirm a preview build does **not** run migrations.
