# One deployment, two tenancy modes

**Status:** approved design · revised after seven audit passes
**Date:** 2026-09-13
**Supersedes:** the two-build-profile design and the backward-compatible
cutover in this file's earlier revisions (see git history).

One version of Feedbackland, hostable either as the multi-tenant platform on
Vercel + Supabase or — the focus — as a dead-simple single-tenant self-hosted
instance, with vendor lock-in minimised for self-hosters.

**Clean slate.** Production is treated as having no prior data: no tenants, no
users, no posts, no images. Nothing is migrated and no backward compatibility
is required. This removes an entire workstream — Firebase user export/import,
legacy password verification, provider-link migration, legacy image URLs — and
most of the risk that came with it.

## Problem

Feedbackland's single deployment shape is welded to three vendors:

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
2. **Production is multi-tenant on Vercel**, `<tenant>.feedbackland.com`, with
   **Supabase** as the Postgres. Both stay.
3. **Single-tenant self-hosting is trivial** and is what everything else is
   optimised around: `docker compose up`, zero accounts, zero env values.
4. **Minimal lock-in for self-hosters.** The only hard dependency is a
   Postgres database. Production's use of Vercel and Supabase is a deployment
   choice the code does not encode — the same image runs anywhere.
5. **Firebase is gone**, replaced entirely by Better Auth.

## Non-goals

- Any data migration or backward compatibility. Clean slate, per above.
- Multi-tenant single sign-on across tenants (§3, "Multi-tenant origins").
- Changing the published `feedbackland-react` npm package (§9).
- Customer custom domains. The chosen TLS approach makes them nearly free
  later; not built now.
- An S3 storage backend. Postgres is the only image store; S3 is additive
  later (§4).

## The shape of the answer

Two observations collapse most of the complexity.

**The app is *almost* entirely org-scoped.** Nearly every query takes an
`orgId`, so multi-tenancy mostly decides *how `orgId` is derived from a
request*, and single-tenant is the same product with a constant resolution
strategy. Multi-tenant support therefore stays in the code permanently and
costs almost nothing.

An earlier revision stated that flatly — "every query takes an `orgId`" — and
an audit found it false. Four queries fetch or mutate by primary key with no
tenant predicate at all (§1, "Cross-tenant object access"). The premise
survives only because those four are fixed as part of this work.

**With production free to change vendors, there is nothing left to abstract.**
An earlier design needed ports and adapters so two build profiles could
diverge. One version needs one auth, one storage, one everything — so the
adapter layer disappears, along with the build-time bundler aliasing that was
the riskiest mechanism in that plan.

```
                   ┌──────────────────────────────────────┐
                   │  Next.js + Better Auth               │
                   │  Vercel build  ·  or Docker image    │
                   └──────────────────┬───────────────────┘
                                      │  DATABASE_URL
                                      ▼
                        ┌────────────────────────────┐
                        │  Postgres + pgvector       │
                        │  data · identity · images  │
                        │  (Supabase in production)  │
                        └────────────────────────────┘

   MULTI_TENANT_ROOT_DOMAIN unset          →  single tenant   (self-hoster default)
   MULTI_TENANT_ROOT_DOMAIN=example.com    →  multi tenant    (<tenant>.example.com)
```

**Tenancy is a runtime mode, not a build flag.**

## §1 — Host-based tenant resolution

Today the tenant travels three ways at once: a path segment
(`app/[orgSubdomain]/`), a client-sent `subdomain` header, and a "subdir mode"
for localhost and `*.vercel.app`. All three collapse into one rule:

> The tenant is whatever the request's `Host` says it is. The client never
> tells the server which tenant it is.

```
MULTI_TENANT_ROOT_DOMAIN unset            → the single org (cached); Host ignored
MULTI_TENANT_ROOT_DOMAIN set:
  host == MULTI_TENANT_ROOT_DOMAIN / www  → no tenant (signup)
  <label>.MULTI_TENANT_ROOT_DOMAIN:
      label reserved         → no tenant
      label is a uuid v4     → org by id
      otherwise              → org by orgSubdomain
```

**The switch is named `MULTI_TENANT_ROOT_DOMAIN`, not `ROOT_DOMAIN`, and that
is a deliberate correction.** An earlier revision called it `ROOT_DOMAIN`,
which is a trap for exactly the person this design is optimised for: a
self-hoster standing up `feedback.acme.com` would very reasonably set
`ROOT_DOMAIN=feedback.acme.com`, meaning "this is my domain" — and silently
switch the instance into multi-tenant mode. Their board would then resolve no
tenant, `/` would redirect to `/signup`, and the failure would look like the
product being broken rather than like a setting.

The variable a self-hoster wants for their own domain is `APP_URL`. Multi-tenancy
is opt-in under a name nobody sets by accident, and an instance that never sets
it never has a tenant concept at all: `/signup` 404s, the subdomain field is
absent from settings, the uuid→slug redirect below is inert, and
`reservedSubdomains` is never consulted. **Single-tenant self-hosting has no
subdomains in it anywhere.**

The host is normalised first: lower-cased, port stripped, trailing dot
removed. `ACME.Example.com`, `acme.example.com:3000` and `acme.example.com.`
are the same tenant, and `acme.localhost:3000` must match in development — a
raw `Host` comparison fails all three.

Resolution is memoised per host with a short TTL, **including negative
results**, and invalidated on org update. `x-forwarded-host` is honoured only
when `TRUST_PROXY=true` (§3, "Proxy trust").

`reservedSubdomains` is corrected to `["www", "api", "auth", "admin", "app",
"static", "public", "assets", "setup", "signup", "feedback", "new"]` —
today's list still contains `get-started` (a route being removed) and omits
`www`, `setup` and `signup`, each of which is now a real route or host.

Local multi-tenant development uses `acme.localhost:3000`; browsers resolve
`*.localhost` to loopback, which replaces subdir mode outright.

**The uuid → slug redirect stays — in multi-tenant mode only.** Host-based resolution can serve
`<orgId>.feedbackland.com` directly, which makes the existing redirect look
redundant. It is not: the published widget builds
`https://<platformId>.feedbackland.com` and the popover renders "view all
feedback" links to that origin, so without the redirect a visitor who follows
one lands on a raw-uuid hostname instead of the tenant's branded URL. It moves
out of `proxy.ts` into the `(board)` layout — when the host is a uuid label
and the resolved org has a different slug, redirect to the slug host
preserving path and query. In single-tenant mode there are no uuid hosts and
no slugs to canonicalise, so the branch never runs; it is gated on the mode
rather than left to coincidentally no-op.

### Security fix: deleting `/api/user/upsert-user`

This endpoint is currently **unauthenticated and trusts a client-supplied
`userId`**: `upsertUserSchema` takes `userId`, `email` and `orgSubdomain`
straight from the request body, and `upsertUserQuery` will insert a `user`
row, insert a `user_org` membership, and — via
`onConflict(...).doUpdateSet({ name })` — **overwrite any existing user's
display name**, which is impersonation on a public board. There is no
privilege escalation (the role is hard-coded `user`), but arbitrary user
creation and renaming is live today.

An earlier revision fixed this by authenticating the endpoint and deriving the
identity from the session. **Deleting it outright is better**, and costs less.

The endpoint exists only so the client can obtain `{ user, userOrg, org }`
after sign-in. `trpc/get-user-session.ts` already returns **exactly that
shape**, already as a `userProcedure` — authenticated, with `orgId` and
`userId` taken from context rather than from the caller. The REST route is a
second, weaker door to the same room.

So: the "ensure `public.user` and `user_org` rows exist" step moves server-side
into an authenticated `ensureSession` mutation the client calls once after
sign-in, using the verified uid and email and the `Host`-resolved org;
`getUserSession` stays a pure read for refreshes. `POST /api/user/upsert-user`,
`upsertUserSchema`'s client-supplied `userId`/`email`/`orgSubdomain`, and the
whole class of "anyone can create a user or rename someone" **cease to exist**
rather than being patched.

A vulnerability that is deleted cannot regress; one that is fixed can. The
verification for it changes accordingly — from "a forged `userId` is rejected"
to "the route is gone and nothing references it".

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
data already readable to anyone holding the id, and nothing is enumerable. The
upvote paths are worse — an unauthorised cross-tenant *mutation* — though still
gated on knowing an id. For a single-tenant self-hoster it is a non-issue by
construction: there is one org.

It is fixed regardless, because this design's claim is that the same artefact
is safe to run as a multi-tenant platform, and "tenant isolation depends on ids
being hard to guess" is not a claim worth making. The two reads take `orgId`
and filter on it; the two upvotes verify the target belongs to `ctx.orgId`
(comments join `feedback` for theirs, since `comment` carries no `orgId`).
Each gets a test asserting a cross-org id is rejected.

`set-activities-seen` and `update-user` also lack an `orgId` but are scoped by
`userId` and are correct as they stand; `get-org`, `has-claimed-org` and
`check-rate-limit` are deliberately instance-level.

**Deleted by this section:** `getSubdomain`, `getMaindomain`,
`getIsSubdirOrg`, `navigateToSubdomain`, `getVercelUrl`, `useSubdomain`,
`useMaindomain`, `useVercelUrl`, the `subdomain` request header, and
`app/api/org/[orgId]/route.ts`. They are deleted rather than deprecated, so
every stale caller becomes a compile error.

`app/api/chat/route.ts` is easy to miss: it does its own auth and tenancy
inline (`req.headers.get("subdomain")` plus a Firebase token check in
`resolveAdminOrgId`) rather than going through tRPC context, so it is migrated
to `Host` + `auth.api.getSession` by hand.

`components/app/ask-ai/storage.ts` is the subtle one. It builds its
sessionStorage key from `getSubdomain()` and **returns `null` when there is no
subdomain**, so every read yields `[]` and every write no-ops. Delete
`getSubdomain` without touching it and Ask-AI conversation history silently
stops persisting in single-tenant mode — no error, no crash, a smoke test
still passes. It is re-keyed on the resolved org id.

### Dead code that looks load-bearing

Three paths read as live infrastructure and are not. Each is deleted, and each
is listed because an implementer who assumes they matter will either preserve
them for nothing or draw a wrong conclusion:

- **`lib/firebase/admin.ts: adminDatabase`** — a Realtime Database handle
  imported by nothing. It is the sole reason `FIREBASE_DATABASE_URL` is a
  documented required variable the guide tells operators to invent a value for.
- **`hooks/use-sse.ts`** — nothing constructs an `EventSource`. Worth recording
  *why* it must not return casually: `EventSource` cannot send an
  `Authorization` header, so any future SSE endpoint would need a cookie this
  architecture deliberately does not have. Streaming goes over `fetch`, as
  Ask-AI already does.
- **`providers/iframe.tsx` + `iframeParentAtom`** — a penpal RPC channel with
  `allowedOrigins: ["*"]`, never mounted. Easy to mistake for the widget's
  communication layer; the real protocol is the `postMessage` readiness
  handshake in the root layout and `platform-ready-signal`.

## §2 — Routing

`app/[orgSubdomain]/(board)/…` becomes `app/(board)/…`. Because the tenant
lives in the hostname, **URLs are identical in both modes**: `/`, `/<postId>`,
`/admin`.

Wherever a tenant resolves, `/` is the board. The single exception is the root
domain in multi-tenant mode, where no tenant resolves and `/` redirects to
`/signup`. That redirect belongs in the `(board)` **layout**, not the page: a
layout wraps its pages, so redirecting from the page would still render the
board chrome for a request that has no org, against a `useOrg` query that
cannot succeed. `/signup` and `/setup` live outside the group. Keeping one
`/` route that branches on the resolved tenant avoids two route trees both
claiming `/` — a hard Next.js build error, not a preference.

`[postId]` is now a root-level dynamic segment, so it is guarded to UUIDs;
anything else 404s rather than attempting a post lookup. Static segments
(`admin`, `signup`, `setup`, `api`) take precedence in Next's matcher.

**Routes removed:** `app/get-started/` (becomes `/signup`, with a permanent
redirect so existing links survive), `app/[orgSubdomain]/claim/`, the claim
step of `components/app/create-org-wizard/`, and the empty leftover
`app/design-preview/`.

**No middleware is required for tenancy**, which matters because
[vercel/next.js#86122](https://github.com/vercel/next.js/issues/86122) reports
`proxy.ts` silently not executing under `output: "standalone"` behind some
reverse proxies. `proxy.ts` is reduced to one job — setting the
`?embed=drawer` header for correct first paint — which degrades to a single
frame of flash if it never runs.

Cost: pages that read `Host` render dynamically. Accepted.

**The board must be served at the root of a hostname**, not under a path.
`https://feedback.acme.com` works; `https://acme.com/feedback` does not, and
this is a stated constraint rather than an oversight. Next's `basePath` would
move the API routes with it, but the published widget computes its submission
endpoint at the **origin root** — `resolvePlatformUrls` deliberately builds
`${origin}/api/feedback/create` so a subdir-style `url` prop cannot produce a
404 — so a `basePath` deployment would silently POST feedback to a path that
does not exist. Supporting it means changing the npm package, which §9 rules
out. Documented in the self-hosting guide next to the domain step, where
someone would otherwise discover it the hard way.

### Framing policy — the board must be embeddable, the admin must not

The app currently sets **no security headers at all**. Every route is
embeddable by any site, which is *required* for the board — the drawer
widget's whole purpose — and *wrong* for everything else. `/admin` being
framable by an arbitrary origin is a clickjacking target: a signed-in admin
can be induced to click destructive controls inside an invisible frame.

Per route, set in `next.config.ts` `headers()`:

| Routes | `Content-Security-Policy` |
|---|---|
| board (`/`, `/<postId>`) | `frame-ancestors *` — embedding is the product |
| `/admin/*`, `/setup`, `/signup`, `/api/auth/*` | `frame-ancestors 'none'` |

`/api/auth/*` is denied because the OAuth popup is a top-level window by
construction; nothing legitimate frames it.

A stricter full CSP is deliberately **not** attempted. The root layout ships an
inline boot script (theme sync and the readiness ping, which must run before
first paint) and Better Auth's popup completion page ships its own inline
script — the package exports `OAUTH_POPUP_SCRIPT_CSP_HASH` for exactly that.
Both would need hashing or a nonce, and getting it wrong breaks first paint or
sign-in. Framing is the risk that actually applies here; the rest is separate,
testable work.

## §3 — Auth

**Better Auth everywhere.** Firebase is deleted, not abstracted. With a clean
slate there is no legacy hash format, no custom password verification and no
provider-link import: Better Auth's own scrypt hashes every password from the
first signup onward.

```
server:  auth.api.getSession({ headers })  →  { user: { id, email } }
client:  signUp/signIn/signOut/getSession + signIn.popup (social)
```

### Table ownership — verified

Better Auth creates a table literally named **`user`**, which collides with the
application's `public.user` (five foreign keys point at it: `activity_seen`,
`comment.authorId`, `feedback.authorId`, `user_org.userId`,
`user_upvote.userId`). Its models are renamed:

```ts
user:         { modelName: "auth_user" },
session:      { modelName: "auth_session" },
account:      { modelName: "auth_account" },
verification: { modelName: "auth_verification" },
```

Verified against a database pre-loaded with the app's real `user` table and a
`user_org` row: `getMigrations` reported `toBeCreated: auth_user, auth_session,
auth_account, auth_verification` and `toBeAdded: (none)`; the app's columns and
rows were untouched; a real sign-up wrote one `auth_user` row while
`public.user` stayed at its original count.

Identity lives in `auth_*`. The app's `public.user` / `user_org` stay the
application's own model, populated on sign-in by the `ensureSession`
mutation (§1) with `user.id` set to the Better Auth user id. `public.user.id` is
already `text`, so no column type changes.

Letting Better Auth own `public.user` outright — mapping `image` → `photoURL`
and adding `emailVerified` — was considered now that no legacy rows constrain
it, and rejected: it would put a library's migrations in charge of a table five
application foreign keys depend on, to remove one upsert that still has to run
anyway for `user_org` membership. Identity and application profile stay
separate on purpose.

There is deliberately no FK from `auth_user` to `user`: deleting an identity
leaves the app user row and therefore leaves authorship on existing posts
intact.

**Known cost, accepted:** Firebase verified an ID token's signature locally, so
authentication touched no database. `auth.api.getSession` reads the session
row, so every authenticated request now costs one indexed lookup — once per
tRPC *batch*, not per procedure, since the client uses `httpBatchLink`. The
right trade for deleting a vendor. Better Auth's `jwt` plugin restores
stateless verification without changing any call site if it ever matters.

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

Bearer-token-in-`Authorization` is therefore mandatory. CSRF is not the problem
people expect: the iframe document is served *from* the board's origin, so its
own `fetch` calls are same-origin.

### Proven end-to-end, both sign-in paths

better-auth **1.7.4**, a real browser, board framed by a different site using
**the widget's exact `sandbox` attribute** (`allow-scripts allow-same-origin
allow-forms allow-popups allow-popups-to-escape-sandbox`). `allow-same-origin`
preserves the frame's origin and therefore its storage: load-bearing for auth,
not incidental, and recorded as such in `OverlayWidget.tsx`.

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

OAuth cannot redirect inside the frame (providers send `X-Frame-Options:
DENY`), so it uses a popup. Better Auth 1.7.4 ships `oauthPopup` /
`oauthPopupClient` for precisely this, documented as attaching "the popup token
as a bearer header **when embedded (where the cookie is partitioned)**". Tested
against a genuinely cross-site identity provider with a real user gesture:

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
possible from an authenticated session. This matches Firebase's behaviour
(`auth/account-exists-with-different-credential`).

Microsoft requires an Entra tenant id (`MICROSOFT_TENANT_ID`, default
`common`) alongside client id and secret.

### Social sign-in across many tenant origins

Google and Microsoft require **exact, pre-registered redirect URIs**. With a
board per subdomain the callback URL differs per tenant, and
`*.feedbackland.com/api/auth/callback/google` cannot be registered. Left
unsolved this blocks social sign-in for every hosted tenant — the popup
mechanics above do not help, because the failure is at the provider's
registration check.

Better Auth ships `oAuthProxy` for exactly this. In multi-tenant mode a single
redirect URI is registered against `MULTI_TENANT_ROOT_DOMAIN`, and the plugin relays the
callback back to the tenant origin that started the flow, with an encrypted
payload and a short `maxAge` against replay. Single-tenant instances have one
origin and one redirect URI, so the plugin is not enabled there.

### Password reset

There is no email infrastructure in this application, and requiring one would
defeat the point of a zero-config self-host. Three tiers, so **no deployment is
ever without a reset path and none requires SMTP**:

1. **`SMTP_URL` configured** → ordinary self-service email reset. Production
   sets this.
2. **No SMTP** → an admin generates a one-time reset link from the Admins page
   and delivers it however they like. This reuses the app's existing idiom:
   `createAdminInvite` already returns a copyable `inviteLink` instead of
   sending email.
3. **First-admin lockout** → `docker compose exec app node scripts/reset-password.mjs <email>`
   prints a one-time link.

Tiers 2 and 3 need no separate token machinery: Better Auth's
`requestPasswordReset` hands the reset URL to a `sendResetPassword` callback,
so with no SMTP that callback **returns the URL to the caller instead of
mailing it**. One code path, one token lifetime, one expiry rule.

Password policy is Better Auth's default minimum of 8 characters, stated so it
is a decision rather than an accident.

### Brute-force protection, and the proxy trap behind it

Better Auth's rate limiting defaults to **`enabled` only in production** and
**`storage: "memory"`**, and keys on the client IP. Two consequences:

- Memory storage is lost on every restart and is not shared between instances,
  so limits are far weaker than they appear. `storage: "database"` puts them in
  the Postgres we already require.
- **The proxy trap:** behind Vercel or Caddy every request arrives from the
  proxy unless `advanced.ipAddress.headers` is configured. Auth rate limiting
  would then key *every user in the world to one bucket* — so one attacker
  brute-forcing a single account locks out sign-in for everyone. A security
  control that becomes a self-inflicted denial of service.

So `rateLimit: { enabled: true, storage: "database" }` always, and
`advanced.ipAddress.headers` set to `["x-forwarded-for"]` **only when
`TRUST_PROXY=true`** — trusting that header without a proxy in front lets a
client spoof past the limit. The same flag governs `getClientIp` for the app's
own LLM rate limits, so there is one switch, not two.

### Session lifetime, sign-out, and the mirror call

Sessions are 30 days with a rolling `updateAge`, so the drawer does not log
people out mid-week. Because tokens are bearer, **sign-out clears the app's own
token store as well as Better Auth's** — the popup plugin only clears the key
it owns, and a token left behind would keep authenticating tRPC calls after an
apparent sign-out. An explicit test case.

`ensureSession` runs immediately after sign-in and is authenticated, so the
bearer token must be captured *before* it is called: capture token → store →
`ensureSession` → session state.

**Server actions cannot see a bearer token.** A Next server action receives
cookies, not the `Authorization` header the tRPC client attaches — and inside
the drawer there is no usable cookie either. The codebase has exactly one
server-action file (`components/app/create-org-wizard/actions.ts`). That
constraint carries over: the `/setup` and `/signup` actions authorise with the
**setup code** or an explicitly passed token, never an ambient session, and
**no board-surface action may depend on one**. Anything needing the signed-in
user goes through tRPC or a route handler, both of which see headers.

### Proxy trust

`advanced.trustedProxyHeaders` and `baseURL.allowedHosts` are gated on
`TRUST_PROXY=true`, default **false**. Enabled when not actually behind a
trusted proxy, a forged `x-forwarded-host` could steer the resolved auth base
URL. Vercel and the Caddy compose files set it; the bare single-container quick
start does not.

### Multi-tenant origins

Each tenant board is its own origin, which Better Auth supports natively:

```ts
baseURL: {
  allowedHosts: [MULTI_TENANT_ROOT_DOMAIN, `*.${MULTI_TENANT_ROOT_DOMAIN}`],
  fallback: `https://${MULTI_TENANT_ROOT_DOMAIN}`,
  protocol: "https",
},
trustedOrigins: [`https://${MULTI_TENANT_ROOT_DOMAIN}`, `https://*.${MULTI_TENANT_ROOT_DOMAIN}`],
```

Wildcard patterns are supported by `matchesOriginPattern`. In single-tenant
mode `APP_URL` pins the origin when set; unset, it is inferred from the
request, which is what makes zero-config `docker compose up` work.

**Bearer tokens are stored per-origin, so a session does not *follow* a user
between tenant boards — but the token is not itself tenant-scoped.** The
session row is global; a token lifted from tenant A and replayed against tenant
B authenticates the same identity there. Not a hole, because every procedure
authorises through `user_org` for the resolved `orgId`, so the user still has
no role on B. Stated explicitly so nobody later mistakes per-origin *storage*
for a per-tenant *trust boundary* and drops an authorisation check.

### The generated secret must come from the entrypoint

`BETTER_AUTH_SECRET` is generated and persisted on first boot when unset, so
nobody runs `openssl rand`. But it **cannot be read from the database inside
the application**: `betterAuth({...})` is constructed synchronously at module
scope, long before any async database call could resolve.

So the container **entrypoint** owns it: take the advisory lock, run
migrations, read-or-create the instance secret row, export
`BETTER_AUTH_SECRET`, then `exec` the server. Module-scope construction stays
synchronous and no call site becomes async.

Vercel has no entrypoint, so it sets `BETTER_AUTH_SECRET` as an environment
variable; the app fails fast if it is missing rather than minting an ephemeral
one that would invalidate every session on the next deploy.

### Removed with Firebase

`firebaseConfig.ts`, both SDKs, the admin credentials, `FIREBASE_DATABASE_URL`
and the dead `adminDatabase` export.

The hardcoded `demo.feedbackland.com` branch in `hooks/use-auth.tsx`
auto-signs visitors in with **credentials committed in source**
(`admin@demo.com` / `demo1234`). The demo board is a product feature worth
keeping; committed credentials are not. See §12.

## §4 — Image storage

Uploads move server-side: `POST /api/images` (size-capped, extension
allowlist, magic-byte validation via the `image-size` call already in
`processImagesInHTML`), bytes in Postgres, served by `GET /api/images/<id>`
with `Cache-Control: immutable` and an ETag. URLs are **relative**, so changing
domain does not orphan stored images.

**Upload cannot require a session.** `feedback-form` calls
`processImagesInHTML(value)` *before* it checks `if (!session)`, so anonymous
visitors attach screenshots today — the board's "Submit Anonymously" path is a
real, shipped feature. Gating `/api/images` on auth would break it in a way
that only shows up for anonymous users with images.

So the endpoint is **unauthenticated but bounded**: the existing per-IP and
per-org rate limiter (already in front of the LLM endpoints) plus
`MAX_IMAGE_BYTES` and content validation. Strictly tighter than today's
arrangement, which hands every visitor a public anon key with insert rights on
the whole bucket.

`GET` stays public — boards are public and images render inside iframes on
third-party domains. Rows carry `orgId` so storage is attributable and an org
delete can cascade. Images referenced by no post or comment are swept by the
same opportunistic cleanup as the other unbounded tables (§5).

`MAX_IMAGE_BYTES` defaults to **4 MB**, deliberately under Vercel's 4.5 MB
request-body limit so one default is safe on every host. The cap applies to
**decoded** bytes, not the base64 data URL the editor holds in memory (base64
inflates by ~33%), and the client checks it before upload so an oversized
screenshot fails with a clear message instead of a 413.

### Downscale on upload, then serve unoptimized

Post and comment bodies render images through `next/image`
(`components/ui/tiptap-output.tsx`), as do the org logo
(`platform-header/title.tsx`) and its settings preview (`settings/logo.tsx`).
`next.config.ts` currently allows one remote host interpolated from
`NEXT_PUBLIC_SUPABASE_PROJECT_ID`, which goes away with Supabase Storage.

An earlier revision set `images: { unoptimized: true }` to bypass the
`remotePatterns` allowlist for legacy Supabase URLs. **That reasoning expired
with the clean slate** — `remotePatterns` governs *external* URLs only, and
every image is now a same-origin relative `/api/images/:id`, which Next
optimizes with no configuration at all. So the trade-off had to be made on its
merits rather than inherited:

| | Optimizer on | Optimizer off |
|---|---|---|
| Viewer bandwidth | resized + WebP | **full-size original to every visitor** |
| Runtime dependency | needs `sharp` | none |
| Stateless container | re-optimizes after every restart (cache is discarded) | nothing to cache |
| Vercel | billed image optimization | free |

Neither column is good: one ships a 4 MB screenshot to every visitor, the
other adds a native dependency, per-host billing and a cache a stateless
container throws away.

**So the work moves to upload time, in the browser.** Before
`processImagesInHTML` uploads, the client downscales to a maximum edge
(~2000px) and re-encodes, falling back to the original encoding where the
browser cannot. This is better on every axis that matters here:

- smaller uploads, which makes the 4 MB cap generous rather than tight;
- **smaller stored blobs**, directly answering the "images in Postgres" cost
  concern in §7 rather than arguing about it;
- serving is a plain byte range behind an immutable cache header, identical on
  Vercel, Docker, Fly or anywhere else;
- **no `sharp`, no optimizer, no optimization cache, no per-platform billing**
  — the vendor-agnostic outcome.

`images: { unoptimized: true }` therefore stays, but as a *consequence* of
already-right-sized images rather than as a workaround. Set globally rather
than per component: three call sites each needing a prop is three chances to
miss one, and a missed one regresses silently. The stored HTML already carries
`width`/`height`, so layout is unaffected.

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
0004_images.sql      §4 image storage
0005_fk_fixes.sql    comment.authorId ON DELETE CASCADE
0006_instance.sql    instance config (generated auth secret, setup code)
```

`0001_init.sql` opens with

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

so the **same DDL runs on stock Postgres and on Supabase**, leaving the
`extensions.halfvec` column types alone. Enums are wrapped in
`DO … EXCEPTION WHEN duplicate_object`; the Supabase storage statements are
dropped, since nothing uses that bucket any more.

`0005_fk_fixes.sql` exists because `comment_authorId_fkey` is the **only one of
the five user foreign keys without `ON DELETE CASCADE`**, so deleting a user
currently fails. Better Auth adds real account-deletion flows, which would hit
this immediately.

`0001_init.sql` also **drops two dead enums**. `subscription_frequency` and
`subscription_name` are defined in the current schema and used by no table —
leftovers from a billing model that does not exist. A clean slate is the one
moment they can go without a migration that touches live data, and carrying
schema nobody can explain is how a schema becomes frightening to change.

### pgvector must also be reachable at *runtime*, not just in DDL

Putting the extension in `extensions` is what makes one DDL work everywhere —
and on its own it **silently breaks semantic search on stock Postgres**. The
DDL survives because it schema-qualifies everything. Runtime queries do not:
`pgvector/kysely`'s `cosineDistance()` emits a bare operator,

```sql
"feedback"."embedding" <=> $1
```

and `<=>` is resolved through `search_path`. Supabase works because it puts
`extensions` on the search path for its roles. Stock Postgres defaults to
`"$user", public`, so the operator is invisible and the query fails with
`operator does not exist`.

The failure mode is nastier than a clean break: **inserts keep working**,
because an unknown literal coerces to the target column's type without any
search-path lookup. Embeddings would be written correctly and only *searching*
would fail.

**The obvious fix is wrong**, and wrong specifically in production. Setting it
per connection —

```ts
pool.on("connect", (c) => c.query("SET search_path TO public, extensions")); // NO
```

— works on Docker, where the app talks to Postgres directly, and **fails
intermittently on Vercel**, which talks to Supabase's transaction pooler. In
transaction pooling a `SET` outside a transaction lands on whichever server
connection happens to be assigned, does not persist once that connection
returns to the pool, and can leak into an unrelated client's session. Passing
`options=-c search_path=…` is no escape either: PgBouncer rejects the `options`
startup parameter outright.

The fix is a **server-side default**, applied when the backend session starts,
so it holds no matter which pooled connection serves a query. Migration `0001`
uses `ALTER ROLE CURRENT_USER IN DATABASE CURRENT_DATABASE() SET search_path =
…`; a role may alter its own settings without superuser.

**It must append, not replace.** Production is Supabase, where the connecting
role is `postgres` — a role Supabase's own tooling also uses, whose
`search_path` already contains more than `public`. Overwriting it would be a
destructive edit to a shared role in a managed environment. So the migration
reads the extension's actual schema from `pg_extension`, checks whether it is
already reachable, and only then appends. On Supabase that is typically a
no-op, which is the correct outcome.

If a provider forbids even that, the bulletproof fallback is to stop depending
on `search_path` by schema-qualifying the operator — `OPERATOR(extensions.<=>)`
in a local helper replacing `cosineDistance` — immune to pooling, roles and
privileges alike. The documented escape hatch, not the default.

### Boot sequence

Run by the container entrypoint inside one `pg_advisory_lock` so concurrent
starts serialise instead of racing:

```
client = await pool.connect()          // a dedicated session, not the pool
  pg_advisory_lock(<constant>)         // session-scoped: released if we crash
    → db/migrations/*.sql via Kysely Migrator (tracked in schema_migrations)
    → getMigrations(auth.options).runMigrations()      [auth_* only]
    → ensure instance secret + setup code rows
  pg_advisory_unlock
client.release()
```

The lock must be taken on a **dedicated client checked out of the pool**:
`pg_advisory_lock` is session-scoped, and a pooled query could take it on one
connection and release it on another. Holding one session also means a crashed
migration releases the lock on disconnect rather than wedging every future
boot. Ordering matters: the SQL migrations own the application schema, Better
Auth owns `auth_*`, and neither creates the other's tables.

**Migrations must use a direct connection, never a transaction pooler.** The
same session-scoping that makes the advisory lock work makes it unsafe through
PgBouncer or Supavisor in transaction mode, where the lock can be acquired on
one backend and released on another — silently, with no error.

| | Runtime | Migrations |
|---|---|---|
| Vercel + Supabase (production) | `DATABASE_URL` — Supabase **transaction pooler**, `:6543` | `DIRECT_DATABASE_URL` — Supabase **session mode**, `:5432` |
| Docker | `DATABASE_URL` — direct; there is no pooler | falls back to `DATABASE_URL` |

`DIRECT_DATABASE_URL` is optional and defaults to `DATABASE_URL`, so the
self-hosted path stays a single value.

**Vercel runs the same sequence from the build command, not an entrypoint** —
there isn't one. `"build": "node scripts/migrate.mjs && npm run build -w feedbackland-react && next build"`,
using `DIRECT_DATABASE_URL`. Two guards, neither optional:

- **Preview deployments must not migrate the production database.** Every
  branch build shares the project's environment variables by default, so the
  migration step runs only when `VERCEL_ENV === "production"`.
- **Concurrent production builds** are serialised by the same advisory lock.

**Migrations stay backward compatible for one release.** On Vercel they run in
the build, *before* the new deployment serves traffic, so the previous version
briefly runs against the new schema and during a rollout both are live. Every
migration here is additive — expand now, contract in a later release, never
both in one deploy.

**Housekeeping.** Three tables grow without bound and a container has no cron:
the app's `rate_limit`, Better Auth's `auth_verification`, and `auth_session`.
`checkRateLimit` already writes on every call, so it opportunistically deletes
rows whose window closed long ago — bounded work on a path already writing. The
two `auth_*` tables are pruned by the same sweep, keyed off `expiresAt`.

**`db/schema.ts` is generated, and regenerating it is a required step.** It
comes from `npm run kysely-codegen` against a live database, so adding
`images`, `auth_*` and the instance table means regenerating and committing it.
There is a chicken-and-egg — the types the app compiles against come from a
database the migrations must create first — so the order is: migrate a local
Postgres, regenerate, commit. The current file also carries Supabase-internal
schemas (`realtime.*`, `storage.*`, `auth.*`) that vanish when regenerated
against stock Postgres. Intended and safe: `db/schema.ts` is the only file that
references them, which was checked.

## §6 — AI is optional

Creating a post makes three LLM calls inline and throws if any fail: with no
key, `isInappropriateCheck` finds no content, returns `true`, and the post is
rejected as inappropriate. Search is purely vector-based, so with no embeddings
it returns nothing. A keyless instance today is not degraded — it is broken.

### "Unavailable" is not "inappropriate"

There is a live bug here that the keyless work must fix, and it is worse than
the missing-key case:

```ts
const content = data?.choices?.[0]?.message?.content;
if (!content) return true;          // ← any provider failure reads as "inappropriate"
```

Every non-answer — an expired key, an exhausted balance, a 429, a model outage,
a network blip — returns `true`, and `createFeedbackPostQuery` turns that into
`throw new Error("inappropriate-content")`. **So an API key that runs out of
credit silently rejects every post and comment, telling authors their feedback
is inappropriate.** On a feedback product that is close to the worst possible
failure: it looks like censorship, it is invisible to the operator, and nothing
in the UI hints at billing.

Moderation has three outcomes, not two: *allowed*, *refused*, and
**unavailable**. Unavailable degrades to the keyless path — the post is
accepted without AI moderation, titling or embedding — and the failure is
logged for the operator rather than shown to the author. A moderation service
that cannot be reached must never silently become a content ban.

### Capability flag

Runtime, surfaced on the existing `getOrg` payload (already fetched globally by
`useOrg`, so no extra round trip). Not simply `!!OPENROUTER_API_KEY` — a local
model needs no key:

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
distance, so the `ILIKE` branch applies `searchValue` as a filter and then takes
the ordinary `orderBy` path unchanged. Mixing the two would produce a cursor
referencing a column that is never selected — a silently broken "load more".

### Bring your own endpoint

`LLM_BASE_URL`, `LLM_MODEL` and `LLM_EMBEDDING_MODEL` make the four hard-coded
OpenRouter URLs configurable, so Ollama, LM Studio or vLLM work and an instance
can have no external dependency at all. The OpenRouter-specific `reasoning`
parameter is omitted when the base URL is overridden.

### Optional, but actively encouraged

Optional must not mean hidden. A keyless instance is fully usable and is also
missing the feature the product leads with, so the admin area shows a single
dismissible card stating what a key unlocks (insights, Ask-AI, semantic search,
auto-titling), that it costs cents for a small board, and that a local model
works too. Admins only, never on the public board, and never on the posting
path — the one place an upsell would be actively hostile to the person giving
feedback.

**Adding a key later needs a backfill.** Posts created while keyless have
`embedding = null` and would stay invisible to semantic search forever.
`docker compose exec app node scripts/backfill-embeddings.mjs` embeds every row
with a null vector, and the AI section of the docs points at it.

## §7 — Packaging

Two first-class targets, neither a footnote:

- **Vercel** hosts the production multi-tenant platform at
  `<tenant>.feedbackland.com`, with Supabase as the Postgres.
- **Docker** is what a self-hoster runs, single tenant, and is the flow
  everything else is optimised around.

One codebase and one application behaviour; only *packaging* differs.

### `output: "standalone"` must be conditional

Standalone output is for self-hosted and Docker deployments. Vercel builds
through its own pipeline, and setting `output: "standalone"` there is at best
ignored and at worst breaks the deployment. So:

```ts
output: process.env.BUILD_TARGET === "docker" ? "standalone" : undefined,
```

The Dockerfile sets `BUILD_TARGET=docker`; Vercel sets nothing. A packaging
switch with no effect on application behaviour.

### The image

Multi-stage, non-root, published to GHCR by CI on tag. No `sharp` (§4 turns
image optimization off entirely).

**The build stage must install dev dependencies and build the workspace.**
`components/app/widget-docs/index.tsx` imports `FeedbackButton` from
`feedbackland-react`, and the root build is
`npm run build -w feedbackland-react && next build`. A conventional
`npm ci --omit=dev` runner shortcut breaks the build outright. The widget's own
build runs `tsc -b` + vite under `typescript@7`, which relies on the
`@typescript/typescript6` fallback — so that dev dependency must be present in
the build stage. The runner stage then copies only `.next/standalone`,
`.next/static` and `public`.

With fonts vendored (see "The complete vendor surface" below) the build needs
no network beyond the npm registry, and the runtime needs none at all.

### Binding: the mistake that makes a container unreachable

`ENV HOSTNAME="0.0.0.0"` is **mandatory** in the Dockerfile, and its absence is
the most common way a Next standalone container fails. Without it the
standalone server resolves the machine's hostname — inside Docker that is the
container id — and binds there. The process starts, the logs look perfectly
healthy, and **nothing can reach it**. It presents as "the image is broken",
which for a self-hosting audience is the worst possible first impression.

`ENV PORT=3000` sets the default, and Next's standalone server honours
`process.env.PORT`, so platforms that inject their own — Cloud Run, Railway,
Render, Fly — work unmodified because the runtime value wins over the image
default. Those two lines plus the health endpoint are the entire contract a
platform needs, which is what makes "runs anywhere" true rather than
aspirational.

**The image must be multi-architecture.** A large share of self-hosters develop
on Apple Silicon, and an `amd64`-only image either refuses to run or crawls
under emulation — a first impression of "slow and broken" for exactly the
audience this design is optimised for. CI publishes `linux/amd64` **and**
`linux/arm64`; `pgvector/pgvector` is already multi-arch.

### Health

`GET /api/health` returns 200 when the database answers, 503 otherwise. The
compose `app` service declares a healthcheck against it so orchestrators and
`depends_on` work.

### Bring-your-own Postgres needs pgvector

The bundled `pgvector/pgvector` image has the extension; a self-hoster pointing
`DATABASE_URL` at an existing Postgres may not. `CREATE EXTENSION vector` then
fails, and the failure must read as a prerequisite rather than a crash: the
migration aborts naming the extension, the server it connected to, and the two
ways forward.

Making pgvector *optional* was considered — embeddings are only written when an
LLM is configured — and rejected: the columns and HNSW indexes are in the base
schema, and conditional DDL would fork the schema between installs for a
shrinking minority. pgvector is available on RDS, Cloud SQL, Neon, Supabase and
every mainstream managed Postgres.

**TLS is the other bring-your-own-Postgres snag, and it is already a known
one** — the current guide carries a troubleshooting entry for it. Managed
providers commonly require encrypted connections, and `pg` will not negotiate
one by default, so `?sslmode=require` on the connection string is documented in
the env reference rather than left in a troubleshooting appendix where someone
meets it only after a confusing failure. Providers presenting a self-signed or
private CA need the CA supplied instead of disabling verification; both are
documented, and the bundled compose needs neither because the app and database
share a private network.

### The complete vendor surface, enumerated

Vendor-agnosticism is the goal, so it is audited rather than asserted. Every
external dependency that remains after this work, and what is done about each:

| Dependency | When | Verdict |
|---|---|---|
| **Postgres + pgvector** | runtime, required | The one hard dependency. Any Postgres — bundled, RDS, Neon, Supabase, Cloud SQL |
| **Google Fonts** | **build** | `app/layout.tsx` uses `next/font/google` for Inter and Roboto Mono. **Fixed** — see below |
| **npm registry** | build | Unavoidable for any Node project |
| **GHCR** | distribution | Convenience only. The Dockerfile is in the repo; `docker compose build` needs no registry |
| **OpenRouter** | runtime, optional | Off by default, and `LLM_BASE_URL` points at Ollama or anything OpenAI-compatible (§6) |
| **Caddy / Let's Encrypt** | optional recipe | Open source, swappable; any reverse proxy works (below) |
| **Vercel, Supabase** | production only | A deployment choice the code does not encode. Verified: after this work **zero `NEXT_PUBLIC_*` variables remain** — every current use is in a file being deleted or rewritten |

**Google Fonts is the one genuine leftover, and it is removable.** `next/font/google`
downloads Inter and Roboto Mono **at build time**; Next then self-hosts them,
so runtime is already Google-free. But it means a build needs network access to
Google, which breaks air-gapped and offline builds and makes builds less
reproducible — for a product whose pitch is "host it anywhere", that is the
wrong default. Both faces are OFL-licensed, so the `.woff2` files are vendored
into the repo and loaded with `next/font/local`. Cost: a few hundred KB in git.
Benefit: the build has no runtime vendor dependency at all beyond npm.

**Any reverse proxy works, not just Caddy.** Caddy is the documented recipe
because it gets TLS right with one line, but nothing depends on it: the
requirements are simply that the proxy forwards `x-forwarded-host`/`-proto`
(with `TRUST_PROXY=true`), does not buffer the Ask-AI stream, and allows a long
read timeout for insight generation. nginx and Traefik equivalents are
documented alongside, because "you must run Caddy" would be a lock-in of our
own making.

**The published image is pinned, not floating.** The compose file references a
version tag rather than bare `latest`, so `docker compose pull` cannot jump a
major version underneath a running instance; upgrading is an explicit edit, and
the docs say so. `latest` is documented for people who want it.

**`better-auth` is pinned to an exact version.** The `oauthPopup` plugin and
its `better-auth:oauth-popup` message contract are recent, and the drawer
sign-in path depends on behaviour verified against **1.7.4** specifically. A
caret range could change that contract in a patch release, and the failure
would appear only inside a third-party iframe — the hardest place to notice.
Upgrades are deliberate and re-run verification 3.

**The container needs no writable filesystem** beyond `/tmp`: nothing is stored
on disk, image optimization is off, and there is no ISR. It can therefore run
with a read-only root filesystem, which is documented for anyone who wants it.
Being stateless also means a self-hoster can run more than one app container
against the same database without changing anything — migrations serialise on
the advisory lock, rate limits and sessions live in Postgres, and no node holds
state another node needs.

**Leaving is as easy as arriving.** Vendor-agnosticism is not only about what a
product depends on but about whether its data can walk out. Because identity,
content *and images* all live in one Postgres, a single `pg_dump` is a complete,
portable copy of the instance — restore it anywhere and the application comes
back whole. Today's arrangement cannot make that claim: the database is in
Supabase Postgres, the images are in Supabase Storage, and the users are in
Firebase, so "take your data" means reconciling three exports. That property is
worth more than the function-invocation cost §7 charges for it, and it is the
honest counterweight to that trade.

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

No secrets to generate, nothing to fill in, no repository to clone. The
database port is deliberately **not published** — the password is only
reachable on the compose network, and the docs state plainly that anyone
publishing 5432 must change it first.

### Recipe 2 — add a domain

Adds Caddy and sets `DOMAIN` and `TRUST_PROXY=true`; TLS is automatic. Not
optional in practice: host pages are HTTPS, so an HTTP board in an iframe is
blocked as mixed content. Documented prominently, not as a footnote.

Two long-lived responses need the proxy to stay out of the way, and both fail
silently if it does not:

- **Insight generation** batches a whole board through the model and carries
  `maxDuration = 300` — a setting that means nothing outside Vercel. The Caddy
  block sets an explicit long `reverse_proxy` read timeout for that route, or a
  five-minute run surfaces as a truncated response with no error anywhere.
- **Ask-AI streams.** `app/api/chat/route.ts` returns
  `result.toUIMessageStreamResponse()`, a token-by-token stream. Caddy does not
  buffer by default, but the config states `flush_interval -1` for that route
  explicitly rather than relying on content-type sniffing — the failure mode is
  an answer arriving all at once after a long pause, which reads as "the AI is
  broken" rather than as a proxy setting.

### Recipe 3 — multi-tenant on Vercel (this is production)

`feedbackland.com` runs on **Vercel** with **Supabase** as the Postgres.
Host-based tenancy (§1) is what makes this work: a wildcard domain
`*.feedbackland.com` added to the project routes every tenant to the same
deployment, and Vercel issues a certificate per subdomain automatically.
Nothing in the application knows it is on Vercel.

Four platform facts this depends on, each verified rather than assumed:

| Fact | Consequence for this design |
|---|---|
| Wildcard domains require the domain's **nameservers to be Vercel's** (certs issued via DNS-01) | A one-time DNS setup. The only production-side lock-in, and it is DNS, not code |
| Serverless request bodies are capped at **4.5 MB** | `MAX_IMAGE_BYTES` defaults to 4 MB so one value is safe on every host (§4) |
| `maxDuration` is 300 s on Hobby and 800 s on Pro **with Fluid compute**, the default for new projects | The existing `maxDuration = 300` is within range; insights need no re-architecting |
| Each function instance opens its own connections | Runtime uses the pooled `DATABASE_URL`; migrations use `DIRECT_DATABASE_URL` (§5) |

Streaming (Ask-AI) and `headers()` work natively, and `images.unoptimized` (§4)
takes the platform's image-optimization billing out of the picture.

The one thing Vercel cannot do is run an entrypoint, which is why migrations
and the generated secret are handled as described in §5 and §3.

### Recipe 4 — multi-tenant self-hosted (optional, advanced)

Explicitly the lowest-priority path: self-hosters overwhelmingly want one
board, and production multi-tenancy is Vercel's job. Documented because it
falls out of host-based tenancy almost for free, and kept off the critical path
so its complexity never lands on a single-tenant user.

Set `MULTI_TENANT_ROOT_DOMAIN`, point wildcard DNS at the host, and let Caddy issue
**per-tenant certificates on demand** — no wildcard certificate and no
DNS-provider API token:

```
:443 {
  tls { on_demand }
}
```

with `on_demand_tls { ask http://app:3000/api/tls-check }` plus Caddy's
`interval`/`burst` issuance limits.

**`GET /api/tls-check?domain=` is a specified endpoint, not a detail.** It
returns 200 for exactly three things:

1. `MULTI_TENANT_ROOT_DOMAIN` and `www.MULTI_TENANT_ROOT_DOMAIN`.
2. A `<label>.MULTI_TENANT_ROOT_DOMAIN` whose label resolves to an existing org —
   **including uuid labels**, or the widget's default
   `<orgId>.<root>` board entry point never gets a certificate.
3. **Service hosts the deployment actually serves, `api.MULTI_TENANT_ROOT_DOMAIN` first
   among them.** `api` is a *reserved* label, so it resolves to no org and a
   naive "must map to a tenant" rule would 404 it — denying a certificate to
   the hard-coded `DEFAULT_API_ENDPOINT` in the published widget, so every
   popover submission fails with a TLS error no one would connect to a feedback
   form.

Everything else gets 404, answered from the same memoised tenant cache as §1
**with negative results cached**, so handshake probing of random subdomains
cannot become one database query per packet.

**The endpoint does not exist unless this recipe is in use.** It is an
org-existence oracle, and on Vercel — where there is no internal network to
hide it on — it would simply be a public one serving no purpose, since Vercel
issues certificates itself. So it returns 404 unless explicitly enabled, and
when enabled it is additionally reachable only on the internal compose network.
An endpoint that exists for one optional recipe should not be part of the
production attack surface.

### A cost note on images

Images are served from Postgres through `/api/images/:id`, which on Vercel is a
function invocation plus database egress on every cache miss. The immutable
cache header means the edge absorbs the steady state, so this is acceptable —
but it is the strongest argument for the S3-compatible adapter §4 lists as
additive. Using Supabase Storage for production only was rejected: the hosted
product and the self-hosted product would no longer run the same code, which is
the thing this design exists to avoid.

## §8 — First run

**Single tenant.** No claimed org → `/setup` → one form (product name, your
name, email, password) → creates the org, the identity, the `user` row, the
admin `user_org` row, and claims it → redirect to `/`, signed in. Afterwards
`/setup` redirects to `/`.

**Multi tenant.** Root domain `/` → `/signup` → the same underlying "create org
+ first admin" path → redirect to `<slug>.<MULTI_TENANT_ROOT_DOMAIN>`.

Both reuse one code path; the existing `isClaimed` / `hasClaimedOrgQuery`
machinery already models this. The subdomain field in settings and the
`orgSubdomain` branch of `trpc/update-org.ts` are hidden and server-side
rejected in single-tenant mode.

### Setup cannot be hijacked

An instance reachable on the internet before it is claimed would otherwise
grant admin to whoever loads `/setup` first. `/setup` therefore **always**
requires a one-time **setup code**, generated on first boot, stored in the
instance-config table, and cleared once an org is claimed.

An earlier revision made the code conditional on the request coming from a
loopback address. **That is not implementable**: `NextRequest` in Next 16
exposes no socket remote address (`request.ip` was Vercel-only and is gone), so
the only available signal is `x-forwarded-for` — a client-supplied header, and
precisely the thing that must not be trusted for an authorisation decision. A
rule that degrades to "trust a spoofable header" is worse than no rule.

The cost is one line, and the quick start is arranged so it is not even that:
it runs `docker compose up` in the foreground, and the code is printed in the
startup banner in the terminal the operator is already watching.
`docker compose logs app | grep "Setup code"` is documented for the detached
case, and `SETUP_CODE` may be pre-set for anyone automating a deployment.

Binding the published port to `127.0.0.1` instead was considered — it would
make the code unnecessary on a laptop — and rejected because it breaks the
perfectly reasonable "bring it up on a VPS and visit `http://ip:3000`" flow,
trading a visible one-line step for an invisible connection failure.

**`/setup` is rate-limited**, since a setup code that can be guessed at
unlimited speed is not a control. So is `/api/demo-session` (§12): it mints a
real session on every call, so without a limit it is both a session-row flood
and free load on the database.

Before any org exists, `resolveOrg` returns null and every org-scoped procedure
would fail its `publicProcedure` guard. The redirect to `/setup` therefore
happens in the server component **before** the board renders, and `/setup` lives
outside the `(board)` group so none of the board's org-scoped queries mount.

### Promoting single-tenant to multi-tenant

Setting `MULTI_TENANT_ROOT_DOMAIN` on an instance that already has one org promotes it
rather than breaking it: the org keeps its slug and its board moves to
`<slug>.<MULTI_TENANT_ROOT_DOMAIN>`. The subdomain field in settings — hidden in
single-tenant mode — becomes visible so a default slug can be renamed. The docs
state that the old URL must be redirected and the widget snippet updated.

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

Three UI decisions depend on how the instance is configured, and none can be a
build-time constant in a prebuilt image:

- whether AI surfaces are shown (`hasLLM`, §6);
- whether the org **subdomain** field and signup funnel appear at all;
- whether the admin Widget snippet includes a `url` prop — single-tenant must,
  because there is no `<uuid>.<root>` to resolve; hosted multi-tenant omits it.

Today this is decided by `getIsSelfHosted()` / `useIsSelfHosted()` reading
`SELF_HOSTED` and `NEXT_PUBLIC_SELF_HOSTED`. Both are **deleted** along with
the env vars: "self-hosted" is no longer a property of the build, and the
question the UI wants to ask is "is this instance multi-tenant", a *runtime*
fact derived from `MULTI_TENANT_ROOT_DOMAIN`.

So the existing `getOrg` payload carries a small `instance` object —
`{ hasLLM, isMultiTenant, rootDomain? }` — and `useIsSelfHosted` is replaced by
`useInstance()`. No extra round trip. `NEXT_PUBLIC_*` stays empty for a
prebuilt image, which is the constraint that makes one published artefact
possible.

## Environment reference

Nothing below is required for `docker compose up` to work.

| Variable | Default | Effect |
|---|---|---|
| `DATABASE_URL` | set by compose | **The only hard dependency.** Pooled, where a pooler exists |
| `PORT` / `HOSTNAME` | `3000` / `0.0.0.0` | Set in the image; a platform-injected `PORT` wins (§7) |
| `DIRECT_DATABASE_URL` | `DATABASE_URL` | Session-mode URL for migrations; required wherever `DATABASE_URL` is a transaction pooler (§5) |
| `BUILD_TARGET` | unset | `docker` selects `output: "standalone"`; build-time only |
| `MULTI_TENANT_ROOT_DOMAIN` | unset | **Opt-in multi-tenancy.** Set ⇒ tenants at `*.<domain>`; unset ⇒ one board, no subdomains anywhere. Not the variable for "my domain" — that is `APP_URL` |
| `APP_URL` | inferred | Pins the public origin behind a proxy |
| `TRUST_PROXY` | `false` | Honour `x-forwarded-host`/`-proto`/`-for`; set by Vercel and the Caddy recipes |
| `BETTER_AUTH_SECRET` | generated | Entrypoint generates and persists it; required manually where there is no entrypoint |
| `SMTP_URL` / `SMTP_FROM` | unset | Self-service password reset (tier 1) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | unset | Google sign-in |
| `MICROSOFT_CLIENT_ID` / `_SECRET` / `MICROSOFT_TENANT_ID` | unset / `common` | Microsoft sign-in |
| `OPENROUTER_API_KEY` | unset | AI features via OpenRouter |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_EMBEDDING_MODEL` | OpenRouter defaults | Any OpenAI-compatible endpoint; also enables AI without a key |
| `MAX_IMAGE_BYTES` | `4000000` | Upload cap, decoded bytes |
| `DEMO_HOST` + `DEMO_EMAIL` / `DEMO_PASSWORD` | unset | Auto-sign-in for a public demo board (§12); production-only |

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
multi-tenant, deploying on Vercel instead, env reference, troubleshooting. The
quick start is the first screen and needs only Docker.

## §12 — Standing production up from scratch

Production starts empty: no orgs, no users, no posts. There is nothing to
migrate, so this section is a deployment checklist rather than a cutover plan.

1. Supabase project: run the migrations against `DIRECT_DATABASE_URL`; set
   `DATABASE_URL` to the transaction pooler (§5).
2. Vercel project: wildcard domain `*.feedbackland.com` (nameservers at
   Vercel), `api.feedbackland.com` as an additional domain so the published
   widget's default endpoint resolves, `MULTI_TENANT_ROOT_DOMAIN`, `TRUST_PROXY=true`,
   `BETTER_AUTH_SECRET`, and the OAuth credentials.
3. Register **one** redirect URI per provider against `MULTI_TENANT_ROOT_DOMAIN`;
   `oAuthProxy` (§3) relays to tenant subdomains.
4. Create the first orgs through `/signup` like any customer would — the same
   path a self-hoster takes at `/setup`, which is the point.

### The demo board

`demo.feedbackland.com` is a product feature the README links to, and it
auto-signs visitors in so the board is explorable without an account. The
behaviour stays; the credentials leave the repository.

Today `hooks/use-auth.tsx` hard-codes the host and signs in with
`admin@demo.com` / `demo1234` — **compiled into the client bundle** for anyone
to read. An earlier revision proposed moving them to environment variables,
which does not work as written: the sign-in happens in the browser, so
client-readable credentials mean a `NEXT_PUBLIC_` variable — baked in at build
time, breaking the single published image, and still shipped to every visitor.

So the credentials stay **server-side**. `GET /api/demo-session` checks the
resolved host against `DEMO_HOST`, calls
`auth.api.signInEmail({ …, returnHeaders: true })` with server-only
credentials, and returns just the bearer token; the client stores it exactly as
after a normal sign-in. **Verified:** that call returns both a `set-auth-token`
header and `body.token`, and the token authenticates through
`auth.api.getSession`.

The demo org itself is seeded like any other: created through `/signup`, with
the demo account made admin and `DEMO_*` pointed at it. Strictly better than
today — the password never leaves the server.

## Surfaces to change

Not exhaustive to the line, but every file below is *known* to need work, each
found by tracing an actual execution path.

**New** — `lib/tenancy.ts`; `lib/auth/{server,client}.ts`;
`app/api/auth/[...all]/route.ts`; `app/api/images/route.ts` +
`app/api/images/[id]/route.ts`; `app/api/health/route.ts`;
`app/api/tls-check/route.ts`; `app/api/demo-session/route.ts`; `app/setup/`;
`app/signup/`;
`scripts/{migrate,backfill-embeddings,reset-password,drawer-auth-check}.mjs`;
`db/migrations/000{1..6}_*.sql`; `Dockerfile`, `.dockerignore`, `compose.yml`,
`compose.tls.yml`, `Caddyfile`, `.github/workflows/publish-image.yml`.

**Changed** — `next.config.ts` (conditional standalone, `images.unoptimized`,
`headers()`); `db/db.ts`; `proxy.ts` (embed header only); `lib/trpc.ts`
(session + host tenancy); `lib/utils.ts` (URL helpers deleted);
`lib/utils-server.ts` (LLM base URL, moderation outcomes); `lib/schemas.ts`;
`hooks/use-auth.tsx` (Better Auth, demo login via API);
`providers/trpc-client.tsx`; `app/api/chat/route.ts` (**own inline auth + tenancy**);
`app/api/feedback/create/route.ts`;
`queries/{get-feedback-post,get-comment,upvote-feedback-post,upvote-comment}.ts`
(**org scoping**);
`queries/{create-feedback-post,create-comment,get-feedback-posts}.ts`;
`queries/check-rate-limit.ts` (pruning);
`trpc/{get-org,get-feedback-post,update-org,rewrite-feedback}.ts`;
`components/app/{widget-docs,settings/platform-url,create-org-wizard,forgot-password,sso,admins}/*`;
`components/app/ask-ai/storage.ts` (**re-key off org id**); `db/schema.ts`
(**regenerate**); `SELFHOSTING.md`; `README.md`; `.env.example`.

**Deleted** — `firebaseConfig.ts`; `lib/firebase/`; `lib/supabase.ts`;
`hooks/{use-subdomain,use-maindomain,use-vercel-url,use-is-self-hosted,use-sse}.ts`;
`providers/iframe.tsx` + `iframeParentAtom`; `app/api/org/[orgId]/`;
**`app/api/user/upsert-user/`**; `app/get-started/`;
`app/[orgSubdomain]/claim/`; `app/design-preview/`.

## Delivery plan

Ordered so the riskiest unknowns fail first and each phase is independently
verifiable.

| # | Phase | Gate |
|---|---|---|
| 1 | Schema + migration runner with advisory lock; `auth_*` namespace; `search_path`; `0005_fk_fixes`; entrypoint owns secret + setup code | Fresh DB converges; concurrent boots serialise; a killed migration does not wedge the next boot |
| 2 | Dockerfile + compose + health endpoint, multi-arch | Image builds **including the widget workspace** and boots against Postgres on both architectures |
| 3 | Host-based tenancy; delete `[orgSubdomain]`, subdir mode, `subdomain` header; **scope the four cross-tenant queries**; uuid→slug redirect | Single-tenant board at `/`; multi-tenant on `*.localhost`; a cross-org post/comment id is rejected on read *and* upvote |
| 4 | Better Auth replaces Firebase; **delete `/api/user/upsert-user`** for `ensureSession`; linking off; reset tiers; sign-out clears our store | Sign-up/in/out on the standalone board; the REST route is gone and unreferenced; no token survives sign-out |
| 5 | **Drawer auth acceptance test** (verification 3) | Merge blocker |
| 6 | Postgres image storage; `images.unoptimized`; drop `remotePatterns` | Anonymous and signed-in uploads both work; cap enforced |
| 7 | AI optional + BYO endpoint + backfill + "unavailable ≠ inappropriate" | Keyless instance fully usable, paging included; an invalid key does not reject posts |
| 8 | First-run `/setup` + setup code; `/signup`; remove claim wizard | Fresh volume → admin in one form; `/setup` refuses without the code |
| 9 | **Vercel production path**: conditional `standalone`, migrations in the build with the `VERCEL_ENV` guard, pooled vs direct URLs, `oAuthProxy`, demo session | Preview project on a wildcard domain: two tenants, search through the pooler, social sign-in on a subdomain, preview builds do not migrate |
| 10 | Optional self-hosted multi-tenant: Caddy + `tls-check`; docs rewrite | Per-tenant certs on demand; `tls-check` accepts uuid and `api.` labels |

**Tenancy precedes auth deliberately.** Phase 4's `ensureSession` derives the
org from `Host`, which only exists after phase 3; auth-first would mean
building it against the `subdomain` header phase 3 deletes.

**Rollback:** every phase is code-only and reverts by redeploying. With no
production data to preserve, the database can be rebuilt from migrations at any
point before launch — which is the single largest risk reduction in this plan.

## Risks

| Risk | Mitigation |
|---|---|
| Auth fails in the drawer's cross-origin iframe | **Retired.** Both paths proven end-to-end under the widget's exact sandbox, including the no-hidden-cookie check (§3) |
| Popup OAuth breaks where `localStorage` throws | **Measured and fixed**; own completion-message listener + memory store, verified under forced-throw |
| Better Auth takes over `public.user` | **Retired.** `auth_*` renaming verified against a DB holding the real user table: `toBeAdded: (none)`, rows untouched |
| The widget's `sandbox` loses `allow-same-origin` later | Recorded as load-bearing in `OverlayWidget.tsx`; asserted by the acceptance test |
| Auto-linking enables account takeover on unverified emails | Automatic linking **disabled**; linking only from an authenticated session |
| Tenant isolation resting on unguessable ids rather than a predicate | Four unscoped queries fixed and tested with cross-org ids (§1) |
| pgvector reachable in DDL but not at runtime | Server-side `ALTER ROLE … SET search_path` that **appends**, not a per-connection `SET` a pooler drops or leaks; verification searches for real, through a pooler (§5) |
| Advisory lock taken and released on different backends through a pooler | Migrations run on `DIRECT_DATABASE_URL` in session mode (§5) |
| A preview deployment migrates the production database | Migration step guarded on `VERCEL_ENV === "production"` (§5) |
| `output: "standalone"` breaks the Vercel deployment | Emitted only when `BUILD_TARGET=docker` (§7) |
| Auth rate limiting keyed to the proxy IP, locking out all users | `advanced.ipAddress.headers` set only under `TRUST_PROXY`; limits stored in the database (§3) |
| `/admin` clickjacked through an iframe | Per-route `frame-ancestors`; board stays `*` (§2) |
| `/setup` hijacked on an exposed instance | Setup code always required; no reliance on a spoofable header |
| An exhausted or invalid LLM key rejects every post as "inappropriate" | Moderation gains a third outcome, *unavailable*, degrading to the keyless path (§6) |
| Demo credentials shipped to the browser | Server-only `/api/demo-session` mints a bearer token, rate-limited (§12) |
| A build that needs Google reachable, breaking offline/air-gapped builds | Inter and Roboto Mono vendored and loaded with `next/font/local` (§7) |
| A `better-auth` patch release changes the popup message contract, breaking sign-in only inside an iframe | Exact version pin; upgrades re-run verification 3 (§7) |
| `docker compose pull` jumps a major version under a running instance | Compose references a version tag, not bare `latest` (§7) |
| `/api/tls-check` exposed publicly on Vercel as an org-existence oracle | 404 unless the optional multi-tenant recipe enables it (§7) |
| Someone deploys under a path (`example.com/feedback`) and feedback submission 404s | Root-of-hostname stated as a constraint, documented beside the domain step (§2) |
| A self-hoster sets the tenancy variable meaning "my domain" and silently enables multi-tenancy | Renamed `MULTI_TENANT_ROOT_DOMAIN`; `APP_URL` is the one they actually want (§1) |
| Container starts, logs look healthy, nothing can reach it | `ENV HOSTNAME="0.0.0.0"` mandatory in the Dockerfile; platform-injected `PORT` honoured (§7) |
| Managed Postgres rejects the unencrypted handshake | `?sslmode=require` documented in the env reference, not buried in troubleshooting (§7) |
| `amd64`-only image is slow or unusable on Apple Silicon | CI publishes `linux/amd64` and `linux/arm64` (§7) |
| Serving images from Postgres changes production cost shape | Immutable edge caching absorbs the steady state; S3 adapter is the escape valve (§7) |

## Verification

1. `npm run typecheck` and `npx next build` clean. (`npm run lint` is known
   broken on Next 16 and is not a gate.)
2. **Single-tenant smoke from an empty volume** — the primary flow:
   `docker compose up` → `/setup` → post → comment → upvote → search → admin →
   widget snippet embeds and submits from another origin. Assert the absence of
   tenancy too: `/signup` 404s, settings shows no subdomain field, and nothing
   in the UI or the URLs mentions an org slug.
2a. **Runs somewhere that is not Docker Compose.** Deploy the same image to one
   container platform that injects its own `PORT` (Cloud Run, Railway, Render
   or Fly) against a managed Postgres reached over TLS. This is the test that
   catches the two failures that make "host anywhere" untrue in practice — a
   container bound to the wrong interface, and a connection string without
   `sslmode` — and neither is visible from a compose-only run.
3. **Drawer auth acceptance test — merge blocker.** A page on a different site
   embedding the real widget; entirely inside the drawer: sign up, sign out,
   sign in; upvote and comment; reload and stay signed in; social sign-in via
   popup; then repeat with cookies blocked for the board origin, and again with
   `localStorage` forced to throw. Chrome and Firefox at minimum. **The spike
   harness is committed as `scripts/drawer-auth-check.mjs`** — the repo has no
   test runner, so an uncommitted manual procedure would rot.
4. **Tenant isolation**: with two orgs seeded, a post id and a comment id from
   org B are rejected when requested or upvoted while resolved to org A — all
   four queries from §1, read and write.
5. **Security regressions**, each an explicit test: `/api/user/upsert-user`
   **no longer exists** and nothing references it; `/setup`
   without the setup code is rejected, and the code stops working once an org
   is claimed; a second sign-in method on an existing email does not auto-link;
   a bearer token captured before sign-out is rejected after it; `/admin`
   responds `frame-ancestors 'none'` while the board responds `*`; repeated
   failed sign-ins from one address rate-limit **that address only** — the
   assertion that catches the proxy-IP trap.
6. **Semantic search on stock Postgres.** Against the real `pgvector/pgvector`
   container **and** through a pooled connection, a post is created *and then
   found by a semantically-related query*. An insert-only check passes while
   search is broken; a direct-connection check passes while production is
   broken.
7. **Multi-tenant**: two tenants — each resolves its own board; signing in on
   one does not sign you in on the other; a uuid host redirects to the slug;
   social sign-in completes on a tenant subdomain through `oAuthProxy` against
   a single registered redirect URI.
8. **Keyless**: everything in 2 with no LLM configured; AI surfaces absent,
   posting and search still working, "load more" paging correctly under
   `ILIKE`.
9. **Broken key, not absent key**: an invalid or exhausted `OPENROUTER_API_KEY`
   leaves a post **accepted** without AI enrichment and logged, rather than
   rejected as `inappropriate-content`. Repeat for comments, 429 and 402.
10. **Local model**: `LLM_BASE_URL` at Ollama; post creation produces an AI
    title; then `backfill-embeddings` makes older keyless posts searchable.
11. **Production on Vercel — a first-class gate.** Deploy to a Vercel preview
    project with its own Supabase database: the build runs migrations against
    `DIRECT_DATABASE_URL` while the app runs on the pooled one; **semantic
    search works through the pooler**; a wildcard domain resolves two tenants;
    social sign-in completes on a tenant subdomain; Ask-AI streams
    incrementally; insight generation completes inside `maxDuration`; an upload
    just under 4 MB succeeds; the demo host auto-signs in **with no credentials
    in the client bundle**; and a preview build does **not** run migrations.
