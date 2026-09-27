# Feedbackland: self-hosted, single-tenant, vendor-agnostic

**Status:** approved design, revision 3.2 — rewritten after a full adversarial
audit (eight independent reviews, 2026-09-26) that executed the load-bearing
claims against the installed packages, a real Postgres 18 + pgvector, a real
Next 16 standalone build and Better Auth 1.7.6
**Date:** 2026-09-13 (revision 3: 2026-09-26)
**Supersedes:** revisions 1–2 of this file (see git history)

## How to read this document

- **Normative.** Every "must", table value and file name is an instruction.
  Where a choice existed it has been made; there are no open decisions left in
  this document. If an executor finds one, it is a defect in the spec, not a
  licence to choose.
- **Evidence.** Claims about today's code cite `file:line`. Claims about
  libraries cite the installed version. Claims marked *(measured)* were run,
  not read. Appendix B names, for each load-bearing measured claim, the committed Verification check
  that re-proves it, because the audit's own harness was not committed.
- **Corrections.** Earlier revisions contained plausible, wrong claims.
  Appendix A lists the ones that must not be reintroduced; the body states only
  what is true.
- **Phases.** Every deliverable belongs to exactly one phase in the Delivery
  plan, and every gate names the Verification checks that prove it.

## Summary

Feedbackland becomes **one thing**: a feedback board you run yourself, for one
product, on infrastructure you choose. Once §0 retires the hosted product there
is no hosted service, no tenants, no Vercel, no Firebase, no Supabase, and no
backward compatibility to preserve.

At a glance:

| Concern | Decision |
|---|---|
| Process | One Next.js 16 server (`output: "standalone"`), one Postgres. Boot work (migrations, seeding, secrets) runs inside that process from `instrumentation.ts`, so `next dev`, `node server.js` and every container platform boot identically |
| Hard dependency | Postgres **13+** with **pgvector ≥ 0.5.0** (0.7.0 above 2,000 dimensions). Nothing else |
| Tenancy | None. One `settings` row, enforced by `CHECK (id = 1)` |
| Auth | Better Auth, **pinned exactly**. HttpOnly cookie sessions in first-party contexts; bearer tokens only inside the embedded drawer, where cookies are unreliable and never used; admin power only for first-party sessions |
| Images | Postgres `bytea`, served same-origin with a sandbox CSP |
| AI | Optional and **strongly encouraged**: the admin is told what is missing and turns it on in the admin panel with one button, **Connect OpenRouter**, or by pasting an OpenRouter key. OpenRouter only: one account reaches every major model, reports the exact cost of each call, and has a privacy switch. One module speaks to it |
| Install | A Render button, a Railway button, one `compose.yml`, or `docker run` against any Postgres |

Above all it must be **ridiculously easy to get running**: one click, or one
`docker compose up`, and nothing after that requires a terminal — apart, on Compose and `docker run`, from the upgrade command itself (§8).

## Goals

1. **One setup.** The divide between the Vercel-hosted product and the
   self-hosted one disappears, in the code *and* outside it (§0).
2. **Single-tenant only.** Multi-tenancy does not exist, and `settings`
   carries a `CHECK` constraint so it cannot quietly come back.
3. **Self-hosted only.** No hard dependency on Vercel anywhere: not in the
   code, the build, the deploy, or a transitive default (§5 closes the AI SDK's
   Vercel-gateway default).
4. **As little vendor lock-in as possible.** Postgres + pgvector is the whole
   requirement. Every other service is optional, swappable, and absent from the *names* of the variables an operator must set. The one deliberate single-vendor choice is AI, which is optional and goes through OpenRouter — a gateway to every major model, so the model itself is never locked in (§5).
5. **Firebase is replaced by Better Auth** end to end, and Supabase by
   Postgres.
6. **Auth fully works inside a cross-site iframe** (the drawer widget), with
   the browser-specific limits that no web app can overcome stated plainly
   (§3).
7. **Extremely easy to install and operate**: a no-terminal one-click path,
   first-class Docker support, and no operational task (backfill, password
   recovery, upgrade) that silently needs a shell.
8. **AI is optional, and clearly worth turning on.** The board works fully
   without it; admins are told plainly what they are missing; turning it on is one button in the admin panel (Connect OpenRouter) or one pasted OpenRouter key, takes effect without a restart, and is
   bounded in cost and explicit about where data goes (§5).

## Non-goals

Each is a decision with a reason, not an omission.

| Not in v1 | Why |
|---|---|
| Multi-tenancy, subdomains, org switching, a signup funnel | Goal 2 |
| A hosted service | Goal 1; §0 retires the existing one |
| Backward compatibility, data migration, preserving accounts | Full reset. The 2.x widget's hosts are retired by §0, not supported |
| An S3 storage backend | Postgres is the image store. Adding S3 later is additive |
| Serving the board under a path (`acme.com/feedback`) | `basePath` is inlined into client bundles at **build** time, so a path-mounted board needs its own image build; stored image URLs, `next/image`, `/api/chat`, `/api/auth` and the widget's POST all need the prefix. Deferred, and not cheap |
| Embedding from non-web origins (`file:`, Electron, Capacitor, Tauri, browser extensions) | CSP3 `frame-ancestors *` matches only network schemes. Every web page can embed the drawer; custom-scheme hosts cannot |
| A script-tag (non-React) widget | The widget stays a React component in v1. A board-served `/widget.js` is the obvious follow-up |
| Persistent drawer sessions on Safari, iOS and Brave | Those browsers make third-party storage ephemeral by policy; no API restores it without a prompt (§3) |
| A full Content-Security-Policy | The root layout's pre-paint boot script and the OAuth popup script need hashes; framing is the risk addressed here, a full CSP is tracked follow-up work |
| Email verification | No mandatory mail infrastructure. Consequences are handled explicitly (§3) |
| Account deletion UI | Not added; the schema makes deletion possible by any route (§6) |
| OAuth and SMTP secrets in the admin UI | They stay in environment variables: they are set once, at install, next to DNS and domain work, and every platform already stores them as secrets. **AI is the exception** — the one integration admins turn on later, and the one the product asks them to — so its key is entered in the admin panel and stored encrypted (§5); environment variables still work for it and lock the field. The admin UI shows the rest read-only (§10) |
| Other AI providers and local models | AI goes through OpenRouter only (§5): one account reaches every major model, and a single provider is what makes turning AI on one button. The transport is plain OpenAI-compatible HTTP inside `lib/llm/`, so another endpoint is a contained change later |
| A Helm chart, a `curl \| sh` installer | A plain manifest is documented (§8); an installer would only write the same `compose.yml` |
| Vercel, Heroku, Fly, DigitalOcean App Platform, YunoHost, PikaPods as targets | §8 gives each reason |
| Docker Swarm | `docker stack deploy` rejects the compose file's `env_file` long form and `depends_on` conditions; Swarm is not claimed |
| 32-bit ARM | `pgvector/pgvector` publishes amd64 and arm64 only |

## §0 — Retiring the hosted product

The hosted product is **live today**, so "there is no hosted service" is
something this plan *does*, not something it may assume. Verified 2026-09-26:
`feedbackland.com` answers 308, `api.feedbackland.com` 204,
`demo.feedbackland.com` 200, a `<uuid>.feedbackland.com` host redirects 307 to
a real tenant; the GitHub repository carries a connected **Vercel Git
integration** (commit statuses with context `Vercel`, Production deployments
on 2026-09-13); `feedbackland-react@2.12.1` is npm `latest` with ~741
downloads/month and hard-codes `*.feedbackland.com` and
`api.feedbackland.com`; the npm maintainer email is on the same domain.

Everything in this section happens **outside the tree**, is owned by the
maintainer, and is sequenced by phases −1 and 9.

**Before the first merge of this work to `main` (phase −1):**

1. **Disconnect the Vercel Git integration.** Otherwise the first merge
   triggers a Vercel production build of code that can no longer run there.
   Do **not** delete the Vercel project yet: it keeps serving the hosted
   boards until step 6.
2. **Move the npm maintainer account's email off `feedbackland.com` and
   enforce 2FA.** If the domain ever lapsed, its next owner could recover the
   npm account and publish to every `^2`/`^3` install.
3. **Commit to keeping `feedbackland.com` registered indefinitely.** Every 2.x
   widget in the wild iframes `https://<uuid>.feedbackland.com` — unsandboxed before commit `ad5e72f` (2.10), with `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox` after it — and POSTs feedback to `api.feedbackland.com`. Whoever controls the domain
   controls that iframe on customers' sites.
4. **Freeze new hosted signups** (deployed from a hosted-era commit with
   `vercel deploy --prod`, since Git deploys are now disconnected) and notify
   existing hosted boards of the shutdown date, with an export offer (a
   courtesy, not a compatibility promise).

**At release (phase 9):**

5. `npm deprecate feedbackland-react@"<3.0.0" "The hosted Feedbackland service has shut down. Self-host your board and upgrade to feedbackland-react@3: https://github.com/feedbackland/feedbackland"`.
6. Replace the hosted deployment with a **static parking deployment** on
   `*.feedbackland.com` (any static host; the existing Vercel project, serving
   one `index.html` and a 410 function for `api.`, is simply the closest): a page that says the service has ended, links to the
   repository, and still posts the widget's `feedbackland:ready` message so
   old drawers show the page instead of spinning. `api.feedbackland.com`
   answers **410** with the CORS headers the 2.x popover expects, so it shows
   an error instead of an opaque CORS failure.
7. After the announced grace period (30 days unless the notice says
   otherwise): revoke the Firebase service-account keys and delete the
   Firebase project; delete the Supabase project and its public `images`
   bucket. The Firebase web API key committed in `firebaseConfig.ts` stays in
   git history, so the project's deletion is what retires it.
8. Remove every hosted-era credential from local `.env` files (the local `.env` currently holds a Firebase service-account private key and a Supabase connection string). The file itself leaves the checkout in **phase −1**, before the first `docker compose up`: `compose.yml` interpolates `.env` into `DATABASE_URL` and passes the whole file through `env_file`, so a hosted-era `.env` would point boot — which migrates — at the hosted database.

Gate: a push to the branch produces no Vercel status (phase −1);
`npm view feedbackland-react@2 deprecated` is non-empty and the parking page
serves (phase 9).

## §1 — Removing the org concept

The codebase is built around organisations. Counted as word-boundary matches
over `.ts`/`.tsx` under `lib/`, `app/`, `components/`, `hooks/`, `queries/`,
`trpc/` and `db/` (including the generated `db/schema.ts`, excluding `.sql`),
re-counted 2026-09-26:

| Identifier | Occurrences |
|---|---|
| `orgId` | 323 (81 files) |
| `platformUrl` / `usePlatformUrl` / `getPlatformUrl` | 115 (74 + 37 + 4) |
| `orgSubdomain` | 81 |
| `user_org` | 45 |
| `orgName` / `orgUrl` / `isClaimed` | 74 (39 + 21 + 14) |
| `useOrg` / `getOrg` / `updateOrg` / `createOrg` / `claimOrg` | 56 |

Five files outside that scope also carry `orgId` (`proxy.ts`,
`db/schema.sql`, `db/migrations/2026-07-25-insights.sql`,
`feedbackland-react/src/lib/resolve-platform-urls.ts`,
`feedbackland-react/src/PopoverWidget.tsx`), so **86 files carry `orgId`**.
Counting every tenancy identifier (`subdomain`, `org`, `UserOrg`,
`GlobalOrgState`, …) the blast radius is **131 source files**. These counts
scope the work; the gate that proves it done is Verification 6, which is
deliberately broader.

There is no data to migrate, so this is a compile-time change. It is removed
properly:

**The `org` table becomes `settings`**: one row of instance settings
(`platformTitle`, `platformDescription`, the logo, indexing policy, the
setup-complete timestamp; full definition in §6). `settings.id` is
`integer primary key default 1 CHECK (id = 1)`.

**`orgName` and `orgUrl` are dropped, not renamed.** Their only readers are
their own settings editors (`components/app/settings/org-name.tsx`,
`org-url.tsx`) and `queries/get-user-session.ts:33-34,57-58`, whose values
nothing reads; no board component renders either. Both editors are deleted.

**`user_org` disappears; `role` lives on the user.** With Better Auth owning
the user table (§3), `role` is a Better Auth additional field backed by a
`text` column with `CHECK (role IN ('admin','user'))`. The `user_org_role`
enum is not carried forward.

**`orgId` disappears** from `feedback`, `insights`, `insight_reports`,
`admin_invites`, their indexes, and every query, procedure and component that
threads it through.

This also dissolves a class of bug rather than fixing it. Seven queries fetch
or mutate by primary key with no tenant predicate:
`getFeedbackPostQuery` (`queries/get-feedback-post.ts:23`, selects `orgId` at
:28 and never filters on it), `getCommentQuery` (`get-comment.ts:43`),
`upvoteFeedbackPostQuery` (:31,47), `upvoteCommentQuery` (:31,47),
`deleteFeedbackPostQuery` (:25,32 — `orgId` spent only on the role lookup at
:20), `deleteCommentQuery` (:25,32) and `updateCommentQuery` (:35,61).
`createCommentQuery` never checks that `postId` belongs to the org and
`getCommentsQuery` filters only on `comment.postId` (:63), while
`updateFeedbackPostQuery` (:38,66) and `updateFeedbackPostStatusQuery`
(:29,38) *do* filter on `orgId`. With one board there is nothing to cross.

### Tenant resolution goes, mechanism and all

- `publicProcedure` guards on an org today (`lib/trpc.ts:77-82`); the guard
  goes.
- `adminProcedure` reads `ctx.userRole` (:118). The `user_org` join lives in
  `queries/get-user-with-role-and-org.ts:15-16`, which is deleted;
  `createContext` reads the role from the Better Auth session (§3).
- Tenant resolution is **client-supplied**: a `subdomain` request header is
  set by `providers/trpc-client.tsx:72-76` **and**
  `components/app/ask-ai/index.tsx:30-39`, and read by `lib/trpc.ts:18` and
  `app/api/chat/route.ts:27`. The header, both senders and both readers go.
- `ctx.orgIsClaimed` is written at `lib/trpc.ts:32,42,50` and read nowhere; it
  goes.

### The settings API is replaced, not just deleted

`trpc/{get-org,update-org}.ts` and `hooks/{use-org,use-update-org}.ts` are
deleted, but their jobs are not: `useOrg()` has 12 consumers (the header title
and description, the settings page and its six editors, the wizard's widget
step, the admin API and Widget pages) and `useUpdateOrg()` six. They are replaced by:

- **Read:** server-resolved settings delivered through a React context
  (`providers/settings.tsx`, §10) and read with `useSettings()`. No client
  fetch.
- **Write:** `trpc/update-settings.ts` (admin) + `hooks/use-update-settings.ts`,
  whose `onSuccess` calls `router.refresh()` so the server-resolved context and
  `generateMetadata` re-render with the new values.
- `queries/get-org.ts` → `queries/get-settings.ts` (explicit columns, never
  `selectAll()`); `queries/update-org.ts` → `queries/update-settings.ts`.

### `components/app/global-org-state/` is renamed, not deleted

Its only org dependency is `useSubdomain()`. It is also the only writer of
`previousPathnameAtom` (`global-org-state/index.tsx:20-48`), which the post
page's back button (`feedback-post/go-back-button.tsx:30-37`) and the list's
scroll-restore (`feedback-posts/index.tsx:39-43`) depend on, and it resets
three state atoms on navigation. Deleting it compiles and silently breaks
both. It becomes `components/app/board-state/` with the `useSubdomain()` call
removed.

### `platformUrl` goes; absolute URLs come from one helper

`getPlatformUrl()` existed because a board could live at a subdomain **or**
under a path, so internal links were built absolutely. With one board at the
root of a hostname, internal links become **relative** and go through
`boardHref()` (§2), which keeps the drawer's embed signal. `getPlatformUrl`,
`usePlatformUrl` and `hooks/use-platform-url.ts` are deleted.

**Seven things genuinely need an absolute URL**, and all of them get it from
one server helper, `getAppUrl()` in `lib/app-url.ts` (§10 defines the
resolution order):

1. **The admin invite link** (`trpc/create-admin-invite.ts`). Today
   `platformUrl` is a client-supplied tRPC input
   (`create-admin-invite.ts:8`, fed from `components/app/admins/invite.tsx:47`);
   it becomes server-derived. The link is built with `URLSearchParams`:
   today's `…&admin-invite-email=${email}` (:26) is unencoded, so a `+` in a
   plus-addressed email decodes to a space and
   `process-admin-invite-params/index.tsx:66-72` sees a mismatch and **signs
   the user out**.
2. **The widget snippet** (`lib/widget-snippets.ts`,
   `components/app/widget-docs/index.tsx`, whose `previewUrl` memo at :86-97
   silently falls back when handed a relative value).
3. **Ask-AI copied citations** (`lib/ask-ai.ts:114-124`
   `rewriteCitationsForCopy`; its parameter is renamed `appUrl`).
4. **The API examples** (`lib/api-snippets.ts`, and
   `components/app/api-docs/endpoint-card.tsx:6`, which builds the endpoint
   separately).
5. **Better Auth's `baseURL`**: OAuth redirect URIs, which must match what the
   operator registered, and password-reset links (§3).
6. **`metadataBase`** (§2).
7. **The editor's image "Copy link"** action
   (`components/ui/minimal-tiptap/extensions/image/image.ts:166-176`), which
   copies `src` as-is and would copy a relative `/api/images/<id>`.

Client components receive the resolved value as `appUrl` in the settings
context (§10); none of them reads `window.location.origin` as a source.

`lib/api-snippets.ts` never called `getPlatformUrl`; its origin comes from
`window.location.origin` via `components/app/api-docs/index.tsx:28-34`. Its
change is dropping `orgId` from `SnippetParams`, `buildCurl`, `buildJs` and
`buildPython`, and taking `appUrl` from the context. The API docs page also
loses its "Your organization ID" section (`api-docs/index.tsx:47,69`,
`loading.tsx:24`) and its example response's `orgId`.

### Rate limits: the per-org caps become instance caps, and the holes close

`lib/rate-limit.ts` keys caps per IP *and* per org (`:68-69,82-83`); the org
cap is "the real cost cap". Deleting `orgId` naively turns those keys into
constants that are easy to drop as meaningless. They become **instance-wide**
caps with the same purpose, and the endpoints that spend model calls with no
limit today gain one. The complete `RATE_LIMITS` table after this plan:

| Key | Cap | Enforced on | Fails |
|---|---|---|---|
| `feedback-create:api:ip:<ip>` / `feedback-create:api:instance` | 20 / 60 s · 120 / 60 s | `POST /api/feedback/create` (the widget popover and the public API) | open |
| `feedback-create:board:ip:<ip>` / `…:board:instance` | 20 / 60 s · 120 / 60 s | `createFeedbackPost` (the board and the drawer) | open |
| `comment-create:user:<id>` / `…:instance` | 30 / 60 s · 300 / 60 s | `createComment` | open |
| `edit:user:<id>` / `edit:instance` | 30 / 60 s · 300 / 60 s | `updateFeedbackPost`, `updateComment` | open |
| `search:ip:<ip>` / `search:instance` | 30 / 60 s · 300 / 60 s | the query embedding in `getFeedbackPosts` and the activity feed. **When it trips, search falls back to `ILIKE`** instead of failing | open |
| `rewrite:ip:<ip>` / `rewrite:instance` | 20 / 60 s · 120 / 60 s | `rewriteFeedback` | open |
| `ask-ai:user:<id>` / `ask-ai:instance` | 10 / 60 s · 60 / 60 s | `/api/chat` (admin-only; no limit today) | open |
| `images:ip:<ip>` / `images:instance` | 30 / 60 s · 60 / 60 s | `POST /api/images` (§4) | open |
| `sign-in:email:<sha256(lower(email))>` | 10 failures / 900 s | `/sign-in/email`: a `hooks.after` counts failed attempts, a `hooks.before` refuses the next with 429, whatever the IP (§3) | open |
| `sign-up:instance` | 30 / 60 s | `/sign-up/email` | open |
| `search-text:ip:<ip>` / `search-text:instance` | 60 / 60 s · 600 / 60 s | every search, `ILIKE` included — the embedding cap above does not bound a sequential scan; queries are cut to 200 characters on both paths; 429 | open |
| `setup:ip:<ip>` | 5 / 900 s | `/setup` (§7) | **closed** |
| `recover:ip:<ip>` | 5 / 900 s | `/recover` (§7) | **closed** |
| `popup-handoff:ip:<ip>` | 120 / 60 s | the social-sign-in handoff's `start` and `claim` endpoints (§3) | open |
| `ai:instance:day:<UTC date>` | the daily limit (Settings → AI or `AI_DAILY_CALL_LIMIT`, default 5,000) per UTC day; every feature but moderation stops at 80% | every model call except the live check, through `consumeAiBudget`, which counts only allowed calls (§5, *Bounding cost*). At the limit an anonymous post is refused with 429 `DAILY_LIMIT` | **closed** (a limiter error refuses the call rather than spending unbounded; moderation then takes its *unavailable* path) |
| `ai-check:user:<id>` | 10 / 60 s | the AI page's live check (including the credit wait), model list and Connect OpenRouter (§5) | open |

When a posting cap trips, the request is refused with 429; a post is never accepted without moderation to get around a cap. At the daily AI limit anonymous posts are refused, and signed-in content is stored unscreened and recorded in `moderation_event` (§5). The public API and in-board
posting have **separate** instance buckets, so a
flood against the unauthenticated endpoint cannot block posting from the board
and the drawer. `checkRateLimit` today fails open on any error
(`queries/check-rate-limit.ts:46-49`); that stays the default because for a
feedback board a limiter outage should not become a posting outage, but it
makes these caps a **cost control, not a security boundary**, and the security uses `/setup` and `/recover` take a `failClosed` option; `sign-in:email` stays open, since failing closed would turn a limiter outage into a password sign-in outage.

Client IP resolution is one shared function (§3, *Client IP*), used by both
this limiter and Better Auth's. Today's `getClientIp`
(`lib/rate-limit.ts:15-24`) takes the **leftmost** `x-forwarded-for` entry and
its comment says Vercel makes that unspoofable; self-hosted it is
client-controlled, and it disagrees with Better Auth's resolution.

## §2 — Routing, framing and the embed signal

### Routes

`app/[orgSubdomain]/(board)/…` moves to `app/(board)/…`, served at the root of
a hostname: the board at `/`, a post at `/<uuid>`, admin at `/admin/*`. No
dynamic tenant segment, no rewrite, and **no routing depends on middleware**
([vercel/next.js#86122](https://github.com/vercel/next.js/issues/86122),
open since 2025-11-14, reports `proxy.ts` silently not running behind
Cloudflare's proxy). The move happens in **phase 1**, together with the org
removal: once `proxy.ts` stops rewriting hosts, `/` has no page and `/admin`
would resolve to the board with `orgSubdomain = "admin"`.

New routes outside the `(board)` group: `app/setup/` (§7), `app/recover/`
(§7), `app/reset-password/` (§3), `app/auth/popup/` (§3's social-sign-in
popup pages), `app/global-error.tsx` (below).

The `[postId]` page becomes a server component that awaits `params`, calls `notFound()` for any segment that is not a UUID and renders today's client body (a `notFound()` thrown from the current client page, inside the root layout's `<Suspense>`, can leave the response at 200), so
`/robots.txt`, `/sitemap.xml` and typos return 404 instead of the board with
HTTP 200.

**Removed:** `app/get-started/`, `app/[orgSubdomain]/claim/`, all six files of
`components/app/create-org-wizard/`, `app/[orgSubdomain]/form/` (a dead 32-line
stub linked from nowhere, which would otherwise survive as a public `/form`),
`components/ui/field.tsx` (imported only by that stub),
`app/[orgSubdomain]/(board)/admin/ai-roadmap/` (a redirect stub), and seven
empty, untracked directories (deleting `app/api/webhook/polar/` leaves `app/api/webhook/` empty too, and it goes with it): `app/design-preview/`, `app/api/webhook/polar/`,
`app/[orgSubdomain]/(board)/admin/plan/`, `components/app/admin-limit-alert/`,
`components/app/embed-theme-sync/`,
`components/ui/minimal-tiptap/extensions/image-with-new-line/`,
`components/ui/minimal-tiptap/extensions/submit-on-enter/`.

### `proxy.ts` keeps two jobs

Its matcher already excludes `/api/`, `_next/`, `_static/` and dotted first
segments (`proxy.ts:20`; the `_vercel` exclusion is removed). It keeps:

1. **Set** `x-feedbackland-embed` from the query string so the drawer's first
   paint is server-resolved.
2. **Strip** any client-supplied `x-feedbackland-embed` first
   (`proxy.ts:71-82` — "always rewritten, never merged").

If the proxy does not run, `EmbedProvider` resolves from
`window.location.search` on the client (`providers/embed.tsx:46-52`): nothing
breaks, but the first paint is the standalone layout and swaps to the drawer
layout after hydration (padding, background, header and `useIsDesktop` all
change), and the header strip does not happen. Both are cosmetic, and both
are accepted as the cost of not depending on middleware.

**The embed signal is read with any-match semantics.** Next's `has` matcher
compares the **last** value of a repeated query key
(`next/dist/shared/lib/router/utils/prepare-destination.js:102`), while the
app reads the **first** with `URLSearchParams.get` in `proxy.ts:73`,
`providers/embed.tsx:49` and the root layout's boot script
(`app/layout.tsx:40`). Measured: `/?embed=x&embed=drawer` is framable under
the header rule yet renders the standalone header, account menu included.
So `parseEmbedSurface` in `lib/embed-surface.ts` takes `string[]` and returns
`drawer` if **any** value equals `drawer`; `proxy.ts` and `providers/embed.tsx`
call it with `params.getAll("embed")` (the board layout wraps its header value
in an array), and the inline pre-paint boot script, which cannot import it,
uses `params.getAll('embed').includes('drawer')`.

### Framing policy

The app sets no security headers today (no `headers()`, no `vercel.json`;
the only response headers are the CORS blocks on `/api/feedback/create` and
`/api/org/[orgId]`). Every route is framable by any site, which the drawer
needs and nothing else should allow. `next.config.ts` gains `headers()`
(which applies to route handlers too and runs before the filesystem,
`next/dist/server/lib/router-utils/resolve-routes.js:50-56`):

| # | Source | Condition | Header |
|---|---|---|---|
| 1 | `/:path*` | — | `Content-Security-Policy: frame-ancestors 'none'` |
| 2 | `/api/images/:path*` | — | `Content-Security-Policy: default-src 'none'; sandbox; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` |
| 3 | `/` | `has: [{ type: "query", key: "embed", value: "drawer" }]` | `Content-Security-Policy: frame-ancestors *` |
| 4 | `/:postId([0-9a-fA-F-]{36})` | same | same |

**Row order is a security control and stays exactly as shown.** `/:path*`
matches every path including `/` (Next appends an optional trailing slash,
`next/dist/lib/redirect-status.js:42`); three rows set the same
`Content-Security-Policy` key; and "the last matching header key overrides the
first" (`resolve-routes.js:562`, `resHeaders[key] = value`). Measured with
Next's own matcher: images before the default loses the sandbox (the SVG-XSS
control of §4); board rows before the default make the drawer unframable.
`next.config.ts` carries a comment saying so, and Verification 7 asserts the
full header value on `/`, `/?embed=drawer`, `/<uuid>?embed=drawer`,
`/admin`, `/setup` and `/api/images/<id>`.

Sources are path-to-regexp, not globs (`/admin/:path*`, never `/admin/*`).
`/:postId` is constrained to a UUID so the allow rule cannot match `/admin`,
`/setup` or `/api`. A `has` value is an anchored regex
(`prepare-destination.js:101`, `^drawer$`).

**The embed gate is not a security boundary, and the residual risk is stated.**
`?embed=drawer` is a query parameter; anyone can append it. What the gate buys
is a smaller framed surface:

| | |
|---|---|
| **Accepted** | Any site can frame the board and overlay its sign-in dialog. Sign-in inside the drawer is the product |
| **Reduced** | A framed board shows drawer chrome: no account menu, no theme toggle, no admin entry. Admin moderation controls on posts are hidden when embedded (bearer sessions cannot perform admin actions anyway, §3) |
| **Closed** | `/admin/*`, `/setup`, `/recover`, `/reset-password` and `/auth/*` refuse framing. `AdminRoot` additionally refuses to render when `window.self !== window.top`, because `frame-ancestors` does not stop a client-side navigation to `/admin` inside an already-allowed frame |
| **Not attempted** | Framebusting or a user-gesture requirement inside the drawer |

### The embed signal must survive navigation

Only the iframe's first load carries `?embed=drawer`
(`feedbackland-react/src/OverlayWidget.tsx` loads
`${boardUrl}?mode=<dark|light>&embed=drawer`). Every in-board link and
`router.push` today builds a URL without it
(`components/app/feedback-post/compact.tsx:61,107`,
`feedback-form/index.tsx:111`, `feedback-post/go-back-button.tsx:36`,
`feedback-post/options-menu.tsx:89`), so after one click the frame sits at a
parameter-less `/<uuid>`. The comment at `providers/embed.tsx:33-35` ("a full
reload re-reads it from the iframe src") is wrong: a reload re-requests the
frame's *current* URL. Next then performs a **full document load of that
parameter-less URL** in five situations, each verified in `next@16.3.5`:

1. **Every upgrade.** A build-ID mismatch on the next RSC fetch triggers
   `location.assign(canonicalUrl)`
   (`client/components/router-reducer/fetch-server-response.js:175-177`,
   `app-router.js:213-221`). The widget keeps its iframe mounted for the life
   of the host page, so the first click after `docker compose pull && up -d`
   in an already-open drawer goes to a refused frame.
2. **Any non-OK RSC response** (`fetch-server-response.js:143-148`), e.g. a
   502 during a restart or a database hiccup.
3. **Links inside posts and comments**, which render inside the frame: the
   app's link extension replaces tiptap's default
   `{ target: "_blank", rel: … }` with `{ class: "link" }`
   (`components/ui/minimal-tiptap/extensions/link/link.ts:35-42`).
4. **Next's built-in error screen**, whose Reload and Back buttons reload the
   current URL or set `location.href = '/'`
   (`client/components/builtin/global-error.js:55-72`); the app has no
   `app/global-error.tsx`.
5. **Back/forward onto a history entry Next did not create**
   (`app-router.js:289-292`), and the explicit `location.reload()` in
   `process-admin-invite-params/index.tsx:38`.

The widget cannot detect a CSP frame block (`onError` does not fire), so the
visitor sees the browser's "refused to connect" page. Therefore:

- Every in-board href and `router.push` goes through
  **`boardHref(path)`** (`lib/board-href.ts`), which appends
  `embed=drawer&mode=<current>` whenever `useIsDrawerEmbed()` is true. §1's
  relative-link conversion uses it; nothing builds an internal URL by hand.
- `TiptapOutput` renders user-content anchors with `target="_blank" rel="noopener noreferrer nofollow"`.
- **Status spans cannot style the page.** `components/ui/tiptap-output.tsx:36-41` builds ``className={`text-${status}`}`` from a span's `data-label`, and `clean()` keeps `data-label` on any span (`lib/utils-server.ts:200`), so today an anonymous post containing `<span data-type="status" data-label="planned fixed inset-0 z-50 bg-black/80">` covers every board page — and every customer's drawer — with an overlay. `TiptapOutput` renders a status span only when `data-label` is one of the five status values as the editor writes them, and otherwise as plain text; `clean()` drops any other `data-label`.
- `app/global-error.tsx` exists, and its reload keeps the current query
  string.
- `process-admin-invite-params` stops calling `location.reload()`; it
  re-renders from state.
- The comment in `providers/embed.tsx` is corrected.
- Verification 5 opens a post inside the drawer, then forces a frame reload
  and a build-ID change, and the drawer must still render.

An unclaimed instance inside a drawer shows a refused frame (it redirects to
`/setup`, which denies framing). That is intended.

### Metadata and indexing

`app/layout.tsx` hard-codes `robots: { index: false, follow: false }`,
`noimageindex`, `max-image-preview: none`, a static title and description, and
no `metadataBase` (:42-57). On a self-hosted board those are the operator's
decisions:

- `generateMetadata` in the board layout reads settings through
  `lib/settings.ts` for the title and description. `lib/settings.ts` calls
  `await connection()` before touching the database, which makes every page
  under it dynamic. Without that, `next build` prerenders `/` and `/setup` and
  runs the query at build time, where there is no database, baking the fallback
  title in permanently *(measured)*. A failed read falls back to the title
  "Feedback" and logs. No metadata route (`app/icon.*`, `sitemap.ts`,
  `robots.ts`) may read the database — they are prerendered at build — so the
  logo icon is set through `generateMetadata().icons`.
- `metadataBase` is `new URL(getAppUrl())` (§10), never `undefined`.
- The root layout's static `metadata` becomes `{ title: "Feedback", robots: { index: false, follow: false } }`, so `/setup`, `/recover`, `/reset-password` and `/auth/*` no longer say "Feedbackland — User Feedback Platform".
- Indexing follows **`settings.allowIndexing`** (default `true`, an admin
  toggle on the Settings page). `/admin/*`, `/setup`, `/recover`,
  `/reset-password`, `/auth/*` and any page rendered with the drawer surface
  are **always** `noindex`.

### Dead code that looks load-bearing

Each is deleted so nobody preserves it:

- `lib/firebase/admin.ts` `adminDatabase` — a Realtime Database handle imported
  by nothing (the whole file goes with Firebase in phase 3).
- `hooks/use-sse.ts` — nothing imports `useSSE`. Streaming stays on `fetch`.
- `providers/iframe.tsx`, `iframeParentAtom` in `lib/atoms.ts` (the file
  survives) and `IframeParentAPI` in `lib/typings.ts` — a never-mounted penpal
  channel with `allowedOrigins: ["*"]`. The real widget protocol is the
  `postMessage` readiness handshake in the root layout and
  `platform-ready-signal`. This orphans the root `penpal` (the widget's copy is already unused, §9).
- `queries/get-user-org-role.ts`, `hooks/use-maindomain.ts` — no consumers.
- `components/ui/minimal-tiptap/components/image/image-edit-block.tsx`,
  `image-edit-dialog.tsx` **and `components/ui/minimal-tiptap/components/section/five.tsx`**,
  which imports `ImageEditDialog` and is itself imported nowhere. Deleting the
  dialog without `five.tsx` breaks `tsc`. They insert arbitrary external image
  URLs, which §4 forbids.
- Brand leftovers: `app/{apple-touch-icon,android-chrome-192x192,android-chrome-512x512,favicon-16x16,favicon-32x32}.png`
  (not Next metadata file names, so never served), six unreferenced
  `public/feedbackland_logo*` files, and `FeedbacklandLogoFull` in
  `components/ui/logos.tsx`. `app/favicon.ico` is replaced by a neutral
  `app/icon.svg`; the operator's uploaded logo is used as the icon when present,
  through `generateMetadata().icons` (§10).

### `"server-only"`

Forty-four files open with a bare `"server-only";` **string expression**,
which enforces nothing; `import "server-only"` appears zero times. Worse, the
modules that actually read the model key carry no guard at all:
`lib/utils-server.ts:42,130`, `app/api/chat/route.ts:17`, `trpc/generate-insights.ts:257`,
`trpc/rewrite-feedback.ts:43`, as well as `db/db.ts`, `lib/trpc.ts` and every
`trpc/*.ts`. Seven of the 44 are deleted by this plan.

The rule: **every module under `queries/`, `trpc/` (except the router index),
`db/` (except the generated, type-only `db/schema.ts`), `lib/llm/` (except `constants.ts`, which holds only public URLs),
`lib/boot/`, and the files `lib/config.ts`, `lib/runtime-state.ts`,
`lib/auth/server.ts`, `lib/settings.ts`, `lib/app-url.ts`, `lib/client-ip.ts`,
`lib/rate-limit.ts`, `lib/mail.ts`, `lib/secret-box.ts`, `lib/housekeeping.ts`, `lib/trpc.ts` and `lib/utils-server.ts` starts with
`import "server-only";`**, and no file contains the bare string.

This is safe for the boot code because everything runs inside Next's bundle,
which resolves `server-only` to an empty module for the instrumentation layer
as well as for server components and route handlers — measured with the
default bundler, Turbopack (`next build` in Next 16), in both the build and
`next dev`, with a `server-only` import in the boot graph (webpack does the
same: `WEBPACK_LAYERS.GROUP.serverOnly` includes `instrument`). There are no
standalone Node scripts in the runtime image (§6), so nothing imports a guarded
module outside the bundle. The dev-time script that loads the auth configuration, `scripts/print-auth-ddl.ts` (run with `tsx`), imports only `lib/auth/options.ts`, which is deliberately unguarded and free of secrets; harness scripts that import guarded modules run with `tsx --conditions=react-server` (Verification).

CI enforces the rule (Verification 7): a check lists the files matching the
paths above and fails if any lacks the import or any file anywhere contains
the bare string.

### Copy to clipboard on plain HTTP

`http://<ip>:3000` is a supported way in (§7), and it is not a secure
context, so `navigator.clipboard` is undefined there: the invite dialog throws
(`components/app/admins/invite.tsx:105`) and the copy button fails silently
(`components/ui/copy-button.tsx:24`). One helper, `lib/copy-text.ts`, uses
`navigator.clipboard.writeText` when `window.isSecureContext`, else an
off-screen `<textarea>` with `document.execCommand("copy")`, else shows the
value pre-selected in a read-only field. Every copy site uses it —
`admins/invite.tsx:105`, `ui/copy-button.tsx:24`, `ask-ai/markdown.tsx:157`,
`ask-ai/thread.tsx:301`, `minimal-tiptap/components/link/link-popover-block.tsx:26`,
`minimal-tiptap/extensions/image/image.ts:172` — and `lib/copy-text.ts` also exports `copyImage(blob)` (secure contexts only, `navigator.clipboard.write` with a `ClipboardItem`), which `image.ts:155` calls, hiding the image-copy action (`extensions/image/components/image-actions.tsx:99`) when `!window.isSecureContext`. CI fails
on `navigator.clipboard` outside `lib/copy-text.ts`.

## §3 — Authentication

**Better Auth replaces Firebase.** Firebase is deleted, not abstracted. With a
clean slate there is no legacy hash format: Better Auth's scrypt hashes every
password from the first signup, with 8–128 characters (its defaults). Every
path that accepts a new password — sign-up, `/setup`, `/recover`,
`/reset-password` — applies the app's existing rule,
`z.string().trim().min(8).max(128)`, **trimming first**, because the sign-in
and sign-up forms trim today and Better Auth does not: an untrimmed password
with a trailing space would never match at sign-in.

**Version: `better-auth` pinned exactly to `1.7.6`** (no caret), installed in
phase 1. Patch releases change security-relevant code — 1.7.5 → 1.7.6 touched
sign-in, sign-up, password, link-account, callback, context creation and
schema checking — so every bump re-runs Verification 5 and 7 and regenerates
the committed DDL.

### Who owns the user table

**Better Auth owns `user`** (its default model name), with additional fields
on the user and the session:

```ts
user: { additionalFields: {
  role:  { type: "string", required: true,  defaultValue: "user",        input: false } } },
session: { modelName: "auth_session", additionalFields: {
  scope: { type: "string", required: false, defaultValue: "first-party", input: false } } },
account:      { modelName: "auth_account" },
verification: { modelName: "auth_verification" },
rateLimit:    { enabled: true, storage: "database", modelName: "auth_rate_limit" },
```

`input: false` makes both fields immutable from the API: a sign-up carrying
`role: "admin"` is stored as `user`, `/update-user { role }` and
`/update-session { scope }` answer `400 FIELD_NOT_ALLOWED`, and provider
profiles cannot set them *(measured)*.

An earlier revision kept an app-owned `user` table populated by a
client-called `ensureSession` mutation. That is dropped: every creation path
(sign-up, OAuth callback, `auth.api.*`, raw HTTP against `/api/auth/*`) creates
Better Auth's user and none creates an app row, so the app row goes missing
whenever the extra round trip is skipped and every write then fails on a
foreign key *(measured)*. The objection to letting Better Auth own the table —
a library's migrator controlling a table our foreign keys depend on — no
longer applies, because **Better Auth's migrator never runs at runtime**: its
DDL is generated at development time and committed inside our own migration
(§6).

**The DDL, and catching drift.** `npm run db:auth-ddl` runs
`scripts/print-auth-ddl.ts` with `tsx`, which calls
`(await getMigrations(buildAuthOptions(…))).compileMigrations()` (`getMigrations`
from `better-auth/db/migration`; it needs an empty database and no secret)
and prints Better Auth's DDL: `"user"` (with `role text not null`),
`auth_session` (with `scope text`), `auth_account` and `auth_session`
foreign keys `ON DELETE CASCADE`, `auth_verification`, `auth_rate_limit`
(`lastRequest bigint`), and three indexes. It is pasted **verbatim** into
`0001`, followed by separate statements adding what Better Auth does not emit:
`role` default `'user'` and `CHECK (role IN ('admin','user'))`, `scope`
default `'first-party'` and `CHECK (scope IN ('first-party','embedded'))`.

Better Auth validates the schema at runtime (`advanced.database.validateSchema`,
on by default), but only for **presence** of tables and columns — not types,
constraints or indexes *(measured)* — and it caches a mismatch, so every later
`getSession` throws `SchemaMismatchError` and `createContext` turns that into
a 100% tRPC outage. Runtime validation stays on as the alarm. CI catches drift
before it ships in two ways: the boot smoke test (Verification 1) completes
`/setup` and signs up a second user against a freshly migrated database, and a
CI step runs `compileMigrations()` against an empty database and fails on any
difference from the committed block.

Columns of `user`: `id text`, `name text not null`, `email text not null
unique`, `emailVerified boolean not null`, `image text`, `createdAt`,
`updatedAt`, `role`. App code renames `photoURL` → `image` and reads the role
from `session.user.role`. Display-name changes (`trpc/update-user.ts`) call
`auth.api.updateUser`.

### Modules

| File | Phase | Role |
|---|---|---|
| `lib/auth/options.ts` | 1 (extended in 3–4) | `buildAuthOptions(deps)` — a pure function returning the complete options object (fields, model names, rate limit, plugins, providers). No secrets, no database handle of its own, no `server-only` import, relative imports only, so `scripts/print-auth-ddl.ts` can load it. Every server collaborator arrives through `deps` (`db`, `secret`, `sendResetPassword`, `checkRateLimit`, the IP options); `lib/auth/popup-handoff.ts` follows the same rule, and `print-auth-ddl.ts` passes stubs |
| `lib/auth/server.ts` | 3 | `getAuth()` — lazy, memoised on `globalThis.__feedbackland.auth` beside the pool: `betterAuth(buildAuthOptions({ db, secret: getConfig().authSecret, … }))` on first use. A module-scope singleton would be one instance per bundle layer — a route handler and an RSC page got different instances *(measured)* — and OIDC discovery runs per instance, so the layers could disagree about which providers exist. Also `requireAdminSession(session)` (below). **Never constructed at module scope**: `next build` evaluates `lib/auth` while collecting page data, where there is no secret, and a module-scope guard fails the build while no guard crashes the process later through an unhandled rejection *(measured)* |
| `lib/auth/client.ts` | 3 | the browser clients (first-party and embedded), the embedded token store, the popup handoff client |
| `lib/auth/popup-handoff.ts` | 3 (the `set-auth-token` strip), 4 (the handoff) | a Better Auth plugin. Phase 3 ships only its after-hook that deletes `set-auth-token` from responses whose new session is not `embedded`; phase 4 adds the `start`/`claim` endpoints and the `/sign-in/social` and `/callback/:id` hooks. It must be a plugin placed after `bearer()`: Better Auth runs `options.hooks.after` before every plugin's after-hook (`dist/api/dispatch.mjs:137-166`), which is too early to remove a header `bearer()` adds |
| `lib/client-ip.ts` | 1 | the one client-IP resolver (§ *Client IP*) |
| `app/api/auth/[...all]/route.ts` | 3 | `export const GET = (r: Request) => getAuth().handler(r)`, and `POST` the same — behind the 64 KB streaming body cap from phase 5 (§4) — never `toNextJsHandler(getAuth())` at module scope |

### The configuration, stated

- `secret`: `getConfig().authSecret`, which boot sets before the server
  handles a request (§6).
- `baseURL`: `getAppUrl()` when an app URL is **resolved** (§10). When none is,
  `baseURL` is left unset and **`advanced.trustedProxyHeaders: true`**, so
  Better Auth infers the origin from `Host`/`X-Forwarded-*`. This is required:
  in a Next 16 standalone server a route handler's `request.url` is built from
  the **bind** address (`https://0.0.0.0:3000/…`,
  `next/dist/server/next-server.js:1275-1281`), and sign-in and sign-up check
  `Origin` even without a cookie, so an unset `baseURL` without trusted headers
  answers **403 `INVALID_ORIGIN` to every browser sign-in**, including on a
  plain `docker compose up` at `http://localhost:3000` *(measured)*. Trusting
  forwarded headers lets a client choose the inferred origin for its own
  request — harmless for sign-in, but it would let an attacker poison
  **emailed** links (`X-Forwarded-Host: evil.example` produced a reset email
  pointing at `evil.example` *(measured)*). So **SMTP password reset and every
  social provider are disabled unless an app URL is resolved**, and the banner
  says so.
- A **resolved** app URL is also a hard origin check: with `baseURL` from
  `RENDER_EXTERNAL_URL`, a sign-in from a custom domain answers
  `403 INVALID_ORIGIN` *(measured)*. Adding a custom domain therefore means
  setting `APP_URL`; the System panel warns whenever a request's `Host`
  differs from the app URL's host.
- `advanced.useSecureCookies`: `true` exactly when the app URL is **resolved** and `https:`; with an inferred URL, `false` (options are fixed when `getAuth()` is constructed, and an inferred URL exists only per request; an HTTPS origin inferred through a proxy then works with a non-`Secure` cookie). Better Auth derives `Secure`
  from the scheme of a set `baseURL` but forces it in production when
  `baseURL` is unset, which would break first-party sign-in on the supported
  `http://<ip>:3000` flow; with the explicit option, sign-in over plain HTTP
  stores a non-`Secure`, HttpOnly, `Lax` cookie and works *(measured in
  Chromium)*.
- `advanced.database.joins: true` — one query per session read instead of two
  *(measured)*.
- `emailAndPassword`: enabled; `requireEmailVerification: false`;
  `revokeSessionsOnPasswordReset: true` (default `false` — an attacker's
  session would otherwise survive a recovery reset); `sendResetPassword` as
  below. The reset token lives 3,600 s (the default).
- `session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 }` (the
  defaults are 7 days / 1 day).
- `databaseHooks.session.create.before(session, ctx)` returns `{ data: { scope: "embedded" } }` when `ctx.headers` carries `x-feedbackland-scope: embedded` — only the embedded client sends it, on sign-in and sign-up — **or** when the request is itself authenticated by an embedded session (`ctx.context.session?.session.scope === "embedded"`), so an endpoint that mints a new session from a drawer credential (e.g. `/change-password` with `revokeOtherSessions`) stays embedded *(measured)*. Otherwise it returns **nothing**: an explicit `{ scope: "first-party" }` would overwrite the handoff's `createSession(…, { scope: "embedded" }, …)` and hand the drawer a first-party token *(measured)*. `ctx.headers` exists both for HTTP requests and for `auth.api.*` calls given headers; `ctx.request` exists only for the former. (The header name is deliberately not the proxy's `x-feedbackland-embed`, which means something else; `proxy.ts`'s matcher excludes `/api/`, so it neither strips nor sets this header.)
- `databaseHooks.account.create.before` and `update.before` null
  `accessToken`, `refreshToken`, `idToken` and their expiries. The app never
  calls a provider API after sign-in, so neither the database nor a backup
  holds provider tokens (verified in phase 4 by signing a returning provider
  user in again).
- `account.accountLinking.enabled: false` (below).
- `advanced.ipAddress`: from `CLIENT_IP_HEADER` / `TRUSTED_PROXIES` (below).
- `telemetry: { enabled: false }`, explicitly. It is off by default in 1.7.6,
  but it shipped **on** in 1.3.5, and `BETTER_AUTH_TELEMETRY=1` in the
  environment turns it on regardless of the config.
- `hooks.before`: until setup completes, every `/api/auth/*` **HTTP** request
  except `/get-session` answers `403 SETUP_REQUIRED` (§7) — which also blocks
  `/sign-in/social` and `/callback/*`. `ctx.request` exists for HTTP calls and
  is absent for server-side `auth.api.*` calls **even when headers are
  passed**, which is how `/setup`'s own sign-up gets through *(measured)*. Once
  setup is seen complete, the check is latched in `lib/runtime-state.ts` (§6)
  so it costs no query.
- `plugins`, in this order: `bearer({ requireSignature: true })`;
  `genericOAuth` (only when OIDC is configured); `popupHandoff()` (from phase 3, for this strip; phase 4 adds the handoff), whose after-hook also **deletes `set-auth-token` (and removes it from `Access-Control-Expose-Headers`) from every response whose new session is not `embedded`**; and `nextCookies()` last.
  - `requireSignature` is load-bearing: with the default `false`, `bearer()`
    signs any dot-less token itself, and `/list-sessions` returns the **raw**
    token of every sibling session to any session holder, so raw tokens —
    including those in a database or a backup — would be live credentials.
    With it, a raw token is rejected both as a bearer token **and** as a
    cookie *(measured)*.
  - The `set-auth-token` strip is load-bearing too: `bearer()` adds the header
    (and `Access-Control-Expose-Headers`) to **every** response that sets the
    session cookie — first-party sign-in, `/update-user`, each rolling refresh
    — so page script could read the value of the HttpOnly cookie *(measured in
    Chromium)*. Only embedded sessions need the header.

**Better Auth reads environment variables of its own**, which would silently
override this configuration: `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`,
`PUBLIC_BETTER_AUTH_URL`, `NUXT_PUBLIC_BETTER_AUTH_URL`,
`NUXT_PUBLIC_AUTH_URL`, `BASE_URL`, `BETTER_AUTH_TRUSTED_ORIGINS` (always
appended to trusted origins), `BETTER_AUTH_SECRETS`, `AUTH_SECRET`, and
`BETTER_AUTH_TELEMETRY`, `BETTER_AUTH_TELEMETRY_ENDPOINT`, `BETTER_AUTH_TELEMETRY_ID`, `BETTER_AUTH_TELEMETRY_DEBUG`; `NEXTAUTH_URL`, `NEXT_PUBLIC_AUTH_URL` and `VERCEL_URL`, which its client reads during server rendering when it has no `baseURL` (`client/config.mjs:8-21`); and `TEST`, which makes its `isTest()` true for any value but `"false"` and so **switches off the origin and CSRF check** and falls back to a localhost IP (`core/dist/env/env-impl.mjs:36`, `context/create-context.mjs:211`) *(measured)*. Boot calls `neutraliseAuthEnv()`, exported by `lib/config.ts` (the only module that writes `process.env`), which deletes each before Better Auth is constructed and logs a warning naming any that were set; the options also set `advanced.disableOriginCheck: false` explicitly, so the origin check cannot depend on the environment at all. There is no
`TRUSTED_ORIGINS` variable: the popup flow never needs a customer origin, and
adding one would also admit it as a `callbackURL` target.

### Credentials: cookies first-party, bearer only when embedded

The drawer renders the board in an iframe on a customer's domain, where
cookies are not reliably available: Better Auth's session cookie is `SameSite=Lax`, which no browser sends in a cross-site frame (a frame whose host shares the board's site — `www.acme.com` framing `feedback.acme.com` — *does* send and store it, below); Safari and Brave
block third-party cookies; Firefox partitions them, so a cookie set by a
first-party popup never reaches the drawer. (An earlier revision reported
`SameSite=None` cookies "blocked at Chrome default settings"; regular Chrome
in 2026 allows third-party cookies by default, and that measurement was almost
certainly an automation-context or plain-HTTP artefact. The conclusion stands
for the reasons above.)

So there are two modes, chosen by the surface:

| Surface | Credential | Session `scope` |
|---|---|---|
| Standalone board, `/admin`, `/setup`, `/recover`, `/reset-password`, `/auth/popup*` | Better Auth's **HttpOnly** session cookie; `set-auth-token` is never sent, so script cannot read it | `first-party` |
| Inside the drawer (`useIsDrawerEmbed()`) | **Bearer** token in `Authorization`, from the app's token store | `embedded` |

- The **token store** (`lib/auth/client.ts`) is app code: Better Auth's client
  has no pluggable persistence. It keeps the signed token in `localStorage`
  (partitioned by the browser per embedding site) and falls back to memory if
  storage throws. The embedded client captures `set-auth-token` in
  `fetchOptions.onSuccess` (overwriting on every capture; a rolling refresh
  re-sends the **same** token *(measured)*), supplies it through
  `fetchOptions.auth`, and sends `x-feedbackland-scope: embedded`. The embedded tRPC link attaches `Authorization`; first-party requests rely on the cookie. **The embedded surface never sends or stores a cookie**: every request it makes — Better Auth's embedded client (`fetchOptions.credentials: "omit"`; its default is `"include"`, `client/config.mjs:39`), the embedded tRPC link's `fetch`, uploads and `popup-handoff/claim` — uses `credentials: "omit"`. Without it a drawer framed by a *same-site* host sent the board's first-party cookie (so a signed-out drawer acted as the admin), a drawer sign-in replaced the board's first-party session, and a drawer sign-out deleted it *(measured in Chrome)*. As defence in depth, `popupHandoff`'s after-hook removes the session cookie's `Set-Cookie` from every response whose request carried `Authorization` or whose new session is `embedded`. (Ask-AI is admin-only and so always first-party: it uses the cookie.)
- `createContext` calls `getAuth().api.getSession({ headers })` once per tRPC batch. Server components that read the session pass `query: { disableRefresh: true }`: `nextCookies()` cannot rewrite the cookie from a document GET, so a refresh there would move `expiresAt` without the browser learning of it (`integrations/next-js.mjs:67-69,94`). A validly signed bearer token wins over a cookie, even when its
  session is gone (it then yields no session); an unsigned or garbage value
  falls back to the cookie *(measured)*.
- **Admin power is a property of the session row, not of how the token
  arrived.** A signed bearer token *is* the cookie's value — `bearer()` rewrites
  it into the `Cookie` header — so a drawer token replayed as
  `Cookie: better-auth.session_token=…` from any HTTP client authenticates
  without an `Authorization` header *(measured)*; no header-based rule can
  separate the two. So **one helper, `requireAdminSession(session)` in `lib/auth/server.ts`, requires `session.user.role === "admin"`, `session.scope === "first-party"`, and a session younger than 7 days**, and `adminProcedure`, `/api/chat` and every admin page, route handler or server action that reads data server-side call it (`session.createdAt`; older admin sessions get
  `FORBIDDEN` with "sign in again"). The age rule is absolute because a
  `session.create.before` cap is undone by the first rolling refresh, which
  rewrites `expiresAt` to now + 30 days *(measured)*. A token lifted from the
  drawer — the one place a token is script-readable — cannot perform an admin
  action however it is presented. The drawer hides admin controls accordingly
  (§2).
- **CSRF.** First-party mutations carry a `SameSite=Lax` cookie, which cross-site subrequests do not carry but *same-site* ones do (a sibling subdomain; another port on the same host, which on an `http://<ip>:3000` install is the same site). tRPC 11 executes `multipart/form-data` POSTs — which a plain HTML form sends without a preflight — for any mutation with no input or all-optional input *(measured: `@trpc/server` 11.18.0)*. So `app/api/trpc/[trpc]/route.ts` and `/api/chat` answer 415 to every POST whose `Content-Type` does not start with `application/json`, and 403 to every POST whose `Sec-Fetch-Site` is `same-site` or `cross-site`, before any handler runs; the board and the drawer's own requests are `same-origin`. Better Auth's endpoints keep its own origin check. Embedded requests carry no ambient credential.
- **Sign-out** calls `/api/auth/sign-out`, which deletes the session row, and clears the token store. It never navigates: the OIDC provider is configured with `disableProviderLogout: true` (below), because otherwise Better Auth 1.7.6 answers `/sign-out` for an OIDC user with the provider's end-session URL and its client navigates the page there — the drawer to a page that refuses framing, the board away from the site *(measured)*. The drawer gets a signed-in indicator and a **Sign
  out** action in `PlatformHeaderDrawer` (reusing the currently unused
  `components/app/sign-out/index.tsx`); without it a visitor on a shared
  machine cannot sign out of the widget.
- **The trade-off, stated.** A drawer token is script-readable, valid up to 30
  days and replayable, so script execution on the board origin inside a drawer
  (a sanitiser bypass in post HTML, a compromised dependency) can steal that
  visitor's `embedded` session. It can then act as that visitor, and it can
  call `/revoke-sessions` to sign them out everywhere — a nuisance, not an
  escalation. Mitigations: signed tokens only; admin power requires a
  first-party session; user HTML is sanitised on both ends; a full CSP is
  tracked follow-up work.

**Browser reality for the drawer**, which no web application can change:

| Browser | Drawer storage | Consequence |
|---|---|---|
| Chrome, Edge, Firefox | partitioned per embedding site, **persistent** | the visitor stays signed in on that site across reloads and restarts |
| Safari (macOS) and **every iOS browser** | partitioned **and ephemeral** (WebKit: "does not persist to disk and goes away with the application") | sign-in lasts until the browser is closed |
| Brave | partitioned, cleared when the embedding site's last tab closes | sign-in lasts while the site is open |
| any browser with `localStorage` throwing | memory only | sign-in lasts until the frame reloads |

This is stated in the widget docs. The Storage Access API is not attempted in
v1. A drawer session is independent of the visitor's first-party session on
the board and of their sessions on other embedding sites.

**The widget's `sandbox` attribute is load-bearing.** `allow-same-origin`
preserves the frame's origin and therefore its storage; without it sign-in is
impossible. `allow-popups allow-popups-to-escape-sandbox` let the sign-in popup
run unsandboxed. The comment in `OverlayWidget.tsx` (:374-378) is rewritten to
say so, and `scripts/drawer-auth-check.ts` asserts the literal attribute.

### Social sign-in: one popup flow, bound inside the OAuth callback

Identity providers refuse to render in frames (Google and Microsoft both send
`X-Frame-Options: DENY`), so social sign-in uses a popup. Better Auth's
`oauthPopup` plugin completes with a `postMessage` to
`window.opener || window.parent`, and is **not used**, because that channel is
fragile exactly when embedded:

- a host page served with `Cross-Origin-Opener-Policy: same-origin` forces
  popups opened by cross-origin iframes into a new browsing-context group with
  no opener (whatwg/html#8481) — and Helmet, the default Express security
  middleware, sends that header by default;
- Google and Microsoft send `Cross-Origin-Opener-Policy-Report-Only:
  same-origin` on their sign-in pages today (checked 2026-09-26), Microsoft
  briefly **enforced** it on `login.windows.net` in February 2026, and MSAL v5
  dropped its opener-based flow for this reason;
- BroadcastChannel is no fallback: it is partitioned by top-level site in
  Chrome 115+ and Firefox 103+, so the first-party popup and the partitioned
  drawer never share one;
- the plugin is undocumented (its docs page 404s) and marked experimental
  upstream.

Instead, one flow serves both contexts. It is built on Better Auth's standard
`signIn.social` plus the `popupHandoff` plugin, using only public plugin APIs
(`createAuthEndpoint`, `createAuthMiddleware`, `addOAuthServerContext`, `getOAuthState`, the internal adapter's verification-value and `createSession` methods, `setSessionCookie`/`deleteSessionCookie` from `better-auth/cookies`, and the signed value `${token}.${await makeSignature(token, ctx.context.secret)}` from `better-auth/crypto`, which equals the cookie value *(measured)*), and was prototyped end to end against 1.7.6:

1. **When the sign-in dialog opens**, the page generates a random 128-bit
   ticket `T` and secret `S` and computes `h = sha256(S)` (WebCrypto is async,
   so this happens before any click). The click handler only calls
   `window.open("/auth/popup?provider=<p>&ticket=T&h=<h>&mode=<embedded|first-party>")`,
   synchronously, so user activation survives (Safari is strictest).
2. **`GET /auth/popup`** is a first-party page with **no side effects**. It
   answers 400 when `Sec-Fetch-Site` is present and not `same-origin`, so only a page on the board's own origin can open it; a link mailed, posted or placed on another site arrives as `none` or `cross-site`. A link **on the board itself** is the exception: a click on an `<a>` in a post or comment arrives as `same-origin`, exactly like `window.open` *(measured in Chrome)*, and posting is open to anyone. So every renderer of user or model text — `clean()` in `lib/utils-server.ts`, the client render in `components/ui/tiptap-output.tsx`, and Ask-AI's markdown — drops any `<a>` whose `href`, resolved against the app URL, has the board's origin and a percent-decoded path starting with `/auth/` or `/api/`. It shows a
   confirmation, "Sign in to <board title>?". When the popup has a same-origin
   opener whose `location.ancestorOrigins[0]` it can read (Chromium, WebKit),
   it names the embedding site; otherwise it says "Continue only if you just
   clicked Sign in on a feedback widget". Continue POSTs
   `/api/auth/popup-handoff/start { ticket, h, mode }` (rate-limited, §1),
   which reserves `popup-handoff:T` for 10 minutes (first writer wins; a repeat start is accepted when the request's signed `fl_popup_ticket` already equals `T` and `h` matches the reservation, so Back-then-Continue after choosing the wrong account works — a strict rule answers 409 *(measured)*) and sets
   a signed, HttpOnly, `Lax` cookie `fl_popup_ticket=T` in the popup's own
   cookie jar; then it calls `signIn.social({ provider, callbackURL:
   "/auth/popup/done?ticket=T", errorCallbackURL: "/auth/popup/done?ticket=T" })`.
3. **Binding happens inside Better Auth's callback, keyed on the OAuth state**,
   never on a URL parameter. The plugin's before-hook on `/sign-in/social`
   reads `fl_popup_ticket` and records it with `addOAuthServerContext`; the
   state is server-held and completes only in the browser holding the state
   cookie. Its after-hook on `/callback/:id` reads the ticket back from
   `getOAuthState()`: on success in `embedded` mode it mints a **separate**
   session with `scope: "embedded"`
   (`internalAdapter.createSession(userId, false, { scope: "embedded" }, true)`
   — the fourth argument is required, or the field's default overwrites the
   override *(measured)*), stores that session's **raw** token on the ticket (`claim` returns `${token}.${await makeSignature(token, ctx.context.secret)}`, so the database never holds a usable credential),
   and deletes the popup's own session, so no hidden first-party session is left on a shared machine — except that when the callback request carried an earlier, still-valid session cookie (the visitor was already signed in on the board in this browser), the hook re-sets that cookie (`setSessionCookie`) instead of expiring it, so a drawer sign-in never signs the visitor out of the board *(measured)*; in `first-party` mode it
   marks the ticket done; on failure it stores the error code (e.g.
   `account_not_linked`). When the failure happens before Better Auth has parsed the state (`state_mismatch`, `invalid_callback_request`, an expired state), `getOAuthState()` is empty *(measured)*; the hook then reads the popup's signed `fl_popup_ticket` cookie and records the redirect's `error` on that ticket only while the ticket is unbound (this path only ever writes an error, never a token, and cannot overwrite a bound one; a top-level GET to the callback from another site can still fail a visitor's pending, unbound sign-in, since the `Lax` ticket cookie is sent — they retry, and this is accepted), and `onAPIError.errorURL` is `/auth/popup/done`. `/auth/popup/done` itself binds nothing: it posts `{ type: "feedbackland:popup-ready", ticket: T }` (no token) to `window.opener` with the board's origin as `targetOrigin`, shows "Signed in" — or the `error` parameter's message when present — and closes. (Binding "the current session" in `/done`, as an earlier
   revision specified, lets anyone who chose a ticket collect the session of
   any signed-in visitor they lure to `/done` *(measured)*.)
4. **The opening page polls** `POST /api/auth/popup-handoff/claim { ticket,
   secret }` — at 1 s, then backing off to 3 s, for up to 10 minutes, and
   immediately on the ready message. `popup.closed` is never read as a
   cancellation. The server first checks `sha256(secret)` against the reservation's `h` (403 on a mismatch, including while pending); a correct secret on an unbound ticket answers `202 { pending: true }`; once bound it consumes the record atomically and returns `{ token }` (embedded), `{ done: true }` (first-party) or `{ error }`; a replay is 404. The ticket keeps its 10-minute expiry after binding (the opener tab may be suspended while the popup is in front — iOS opens `window.open` as a tab); a 429 is treated as pending and doubles the poll interval (capped at 3 s).
5. Embedded, the token goes into the token store. First-party, the page
   refetches the session: the popup's cookie already sits in the same jar.

**Residual risk, stated.** The flow is structurally a device-authorisation
handoff. The `Sec-Fetch-Site` gate stops a link on another site, in an email or typed into the address bar; the sanitiser rule stops one on the board. What remains is a browser that does not send that header, or a victim persuaded to paste a crafted URL into a same-origin context, who then confirms and completes a provider sign-in within 5 minutes (Better Auth's OAuth state cookie lives 300 s, `dist/state.mjs:72`); even then the
claimed session is `embedded` (no admin power), single-use to claim, and bound
to one ticket. Accepted.

**Providers.**

| Provider | Variables | Callback URI to register |
|---|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `<APP_URL>/api/auth/callback/google` |
| Microsoft (Entra ID) | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (default `common`) | `<APP_URL>/api/auth/callback/microsoft` |
| **Any OpenID Connect provider** (Authentik, Keycloak, Zitadel, Okta, …) | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_NAME` (button label, default "Single sign-on") | `<APP_URL>/api/auth/callback/oidc` |

OIDC is Better Auth's `genericOAuth` plugin with
`config: [{ providerId: "oidc", discoveryUrl: new URL(".well-known/openid-configuration", OIDC_ISSUER.replace(/\/?$/, "/")).href, clientId, clientSecret, disableProviderLogout: true }]` (`disableProviderLogout` is load-bearing, see *Sign-out*).
It registers as an ordinary social provider, so sign-in is
`signIn.social({ provider: "oidc" })`, and its callback is
`/api/auth/callback/oidc` (`/api/auth/oauth2/callback/oidc` is a 404 in 1.7.6
*(measured)*). Discovery runs once, when the plugin initialises; if the issuer
is unreachable then (an identity provider in the same compose file that starts
after the app), the provider is silently skipped and sign-in answers
`404 PROVIDER_NOT_FOUND` until restart *(measured)*. So "enabled" in the System
panel and the banner is derived from Better Auth's own provider list, a failed
discovery is shown as such, and the panel's retry replaces `globalThis.__feedbackland.auth`.

A provider is **enabled** only when its variables are set **and** the resolved
app URL is `https:`: production OAuth state uses a `__Secure-` cookie, and
Google rejects non-localhost HTTP redirect URIs. Buttons render only for
enabled providers — today the Google and Microsoft buttons render
unconditionally (`components/app/sign-in/index.tsx:35-37`,
`sign-up/index.tsx:29-30`) and fail on every default install. The callback
URIs are printed in the banner and shown, copyable, in the System panel (§10);
they change whenever the app URL changes.

### Account linking — off

`requireEmailVerification` is `false`, so linking-by-email would let someone
who registered a password account on an address they do not own inherit the
real owner's account when that owner later signs in with a provider.
`accountLinking.enabled: false` (the default is `true`). Stock Better Auth
already refuses that case through `requireLocalEmailVerified` (default `true`),
but that option is deprecated and slated to become unconditional; disabling
linking removes the behaviour instead of depending on a flag being removed.

With linking disabled, explicit linking fails too: `/link-social` still issues an authorization URL, but its callback refuses with `error=unable_to_link_account` and creates nothing *(measured)*; so there is no "connect Google" screen. A
provider sign-in on an email that already has a password account is refused
with `error=account_not_linked` *(measured)*; the code reaches the drawer or
page through the ticket (which is why step 2 passes `errorCallbackURL`), and
the copy is: *"This email is already registered. Sign in with the method you
used before."*

### Password reset

No deployment depends on SMTP for recovery. `sendResetPassword` is mandatory
(without it `requestPasswordReset` throws `RESET_PASSWORD_DISABLED`) and its
return value is discarded, so the callback can only send or capture. Every path
lands on **`/reset-password`** (first-party, framing denied, noindex), which reads `?token` and calls `authClient.resetPassword({ token, newPassword })`; an expired or used link arrives as `?error=INVALID_TOKEN` (where Better Auth's link callback sends it, `routes/password.mjs:33`) and the page says so, offering a new request.

| Tier | When | How |
|---|---|---|
| **1. Email** | `SMTP_URL` **and** `SMTP_FROM` set, and an app URL resolved | `nodemailer` sends Better Auth's link (`redirectTo: "/reset-password"`, which 302s to `/reset-password?token=…`). `SMTP_FROM` is required, not defaulted: a made-up `no-reply@<host>` fails SPF/DMARC at most receivers |
| **2. Admin-generated link** | always | On the Admins page (`trpc/create-password-reset-link.ts`), an admin creates a one-time link for a **non-admin** user who has a password account. The procedure calls `auth.api.requestPasswordReset` inside an `AsyncLocalStorage` context that tells `sendResetPassword` to capture the **token** (it receives `{ user, url, token }`), and returns `${getAppUrl(headers)}/reset-password?token=<token>` once. Better Auth's own `url` is not used: with no resolved app URL it is relative and lacks `/api/auth` *(measured)*. Issuer, target and time are logged. Admin-to-admin links are refused, because `resetPassword` creates a password account when none exists *(measured)*, which would let one admin take over another |
| **3. Recovery code** | an admin is locked out | `RECOVERY_CODE` plus `/recover` (§7). No terminal |

The forgot-password form branches on `capabilities.smtp` from the settings
context (§10): with SMTP it keeps today's "check your email" copy
(`forgot-password/form.tsx:113-114`); without it, it sends nothing and tells
the visitor to ask an admin of this board for a reset link.
`requestPasswordReset` answers identically for known and unknown emails;
sign-up, however, reveals whether an email exists
(`422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`), which is accepted and stated.
Changing a password while signed in is not added.

### Admin invites

The invite token is a **bearer capability**: with no email verification,
anyone holding a leaked link can sign up with the invitee's address, so an
email-equality check cannot be the control. `admin_invites` gains `expiresAt`
(7 days) and is consumed on redemption. `queries/redeem-admin-invite.ts`
additionally checks, server-side and case-insensitively, that the redeeming
account's email matches (today only the client component checks) — defence in
depth. The link is built with `URLSearchParams` (§1). Redemption happens in a
first-party context, so the new admin's session is `first-party`.

### Client IP

Both rate limiters key on the client IP, and self-hosted there is no
unspoofable source: `NextRequest` has no socket address, and Next fills
`x-forwarded-for` only when absent (`base-server.js:612`, `??=`), so without a
proxy a client can send its own. Better Auth trusts only a **single-value**
header unless `advanced.ipAddress.trustedProxies` is set; a multi-hop chain
resolves to `null`, and every `null` shares one bucket per path *(measured)*.
Behind Render, whose `X-Forwarded-For` is a three-hop chain, that would give
the whole instance **3 sign-ins per 10 seconds**.

Two variables replace the earlier `TRUST_PROXY` flag, and one resolver,
`lib/client-ip.ts`, serves both limiters: it calls `getIP(headers, options)`
from `better-auth/api` (public in 1.7.6; it keys IPv6 by /64) with the same
options Better Auth uses, so the two limiters always agree.

| Variable | Default | Meaning |
|---|---|---|
| `CLIENT_IP_HEADER` | `x-forwarded-for` | The header holding the client address. Set per platform: `true-client-ip` on Render (set by `render.yaml`), `x-real-ip` on Railway (set by its template), `cf-connecting-ip` behind Cloudflare, `x-forwarded-for` behind the bundled Caddy (which overwrites the header with a single value) |
| `TRUSTED_PROXIES` | empty | Comma-separated CIDRs. When set, a multi-value `x-forwarded-for` is walked right to left, skipping these, and the first untrusted address is the client. `lib/config.ts` rejects an entry that is not an IP address or CIDR, naming it (Better Auth would only warn and ignore it). A `null` address keys each limiter's single shared bucket per rule, as Better Auth does |

With no proxy in front, per-IP limits are **best-effort**: a client can choose its own key. The instance caps (§1) bound cost there, and password guessing is bounded **per account**: a `hooks.after` on `/sign-in/email` counts failed attempts under `sign-in:email:<sha256(lower(email))>` and a `hooks.before` refuses the eleventh within 15 minutes with 429, whatever the IP (§1). A targeted lockout of one account's password sign-in is the accepted residual; `/recover` and social sign-in are unaffected. The docs say so.

### Readiness, and what else changes

- **Auth readiness.** `hooks/use-platform-ready.ts` gates the drawer's first
  reveal on `useAuth().isLoaded`, and the tRPC links and Ask-AI block on
  Firebase's `auth.authStateReady()` (`providers/trpc-client.tsx:44`,
  `components/app/ask-ai/index.tsx:31`). Better Auth has no such primitive and
  needs none: credentials are attached synchronously (cookie or stored token),
  so requests no longer wait, and "auth has settled" means the first
  `useSession()` resolution (`isPending === false`).
- **`/api/user/upsert-user` is deleted** (phase 1). It is unauthenticated and
  unrate-limited; for any guessed `userId` it returns the full user row
  including email plus the org row, grants a `user_org` membership, and creates
  arbitrary user rows with attacker-chosen `id`, `email` and `photoURL`
  (`queries/upsert-user.ts`).
- **The demo auto-login** (`hooks/use-auth.tsx:193-211`, which signs in as
  `admin@demo.com` on a hostname match with the password in the source) is
  deleted.
- **Anonymous posting creates no session.** "Submit Anonymously" calls
  `onSuccess(null)` (`components/app/sign-in/index.tsx:48-56`); the form then
  calls the public `createFeedbackPost` with no session, and the post is stored
  with `authorId = null`. `createComment` requires sign-in. Both are preserved
  deliberately. Better Auth's `anonymous()` plugin is **not** used — it would
  create real user rows and an `isAnonymous` column for a feature that needs
  neither.
- **Server actions.** `headers()` works in a server action, but React's
  action dispatch cannot add an `Authorization` header and there is no cookie
  in the drawer, so no board-surface action may depend on an ambient session.
  `/setup` and `/recover` are first-party server actions that authorise with a
  code; everything else goes through tRPC or a route handler. `next-safe-action`
  and `lib/safe-action.ts` are deleted in phase 1 (their only user,
  `create-org-wizard/actions.ts`, goes then); the two actions validate with Zod.
- **Session cost.** One indexed session read per tRPC batch (`httpBatchLink`;
  the session is resolved in `createContext`), plus one write per `updateAge`;
  an HTTP `/get-session` costs three queries including rate limiting
  *(measured)*. `session.cookieCache` is not used: it is inert in the drawer and
  would delay revocation first-party. If this cost ever matters, Better Auth's
  `secondaryStorage` or a short in-process memo keyed by token are
  call-site-transparent, each trading revocation latency.
- **Avatars** stay remote: `user.image` is the provider's URL, rendered by Radix `AvatarImage` (not `next/image`), so every board visitor's browser fetches the provider's image host and a `pg_dump` does not carry avatars. Stated in the docs. Only a provider may set it: `/sign-up/email` and `/update-user` both accept `image`, which would let anyone make every visitor and admin fetch an attacker's host — the tracking pixel §4 removes from post bodies — so `databaseHooks.user.create.before` and `update.before` keep `image` only when `ctx.path` starts with `/callback/` and the value is an `https:` URL, and null it otherwise; `name` is trimmed and capped at 100 characters.

### Capabilities that must survive

| Capability | Today | After |
|---|---|---|
| Email sign-up / sign-in / sign-out | Firebase | Better Auth; the drawer gains a sign-out action |
| Google, Microsoft sign-in | Firebase popups | Better Auth providers through the popup handoff; hidden unless configured |
| Generic OIDC | — | new (Goal 4) |
| Forgot password | Firebase-hosted flow | three tiers and a `/reset-password` page |
| Anonymous posting | no session, `authorId` null | unchanged |
| Display-name change | `trpc/update-user.ts` | via `auth.api.updateUser` |
| Avatars | remote `photoURL` | remote `image` |
| Email verification | none | none |
| Account deletion | none | none; the schema allows it (§6) |
| Token refresh | Firebase SDK | rolling session; the re-emitted `set-auth-token` is the same token, so the real check is that `auth_session.expiresAt` moves forward |
| Admin invite redemption | client-side email match | expiring, single-use token plus a server-side match |

## §4 — Images

Images move from a Supabase bucket to Postgres, uploaded through one endpoint
and served same-origin. This is what makes a single `pg_dump` a complete copy
of the board (avatars excepted, §3) and keeps the vendor surface at one.

### Today, precisely

- The upload primitive is `uploadImage` in `lib/utils.ts` (:161-276, with
  `processImagesInHTML`, `base64ToBlob`, `getImageInfoFromDataUrl`), which
  imports `lib/supabase.ts` (:3). `lib/supabase.ts` hands every browser a
  `NEXT_PUBLIC_` anon key, and `db/schema.sql:288` grants that key insert on
  the `images` bucket: **anyone can write to the bucket without loading the
  form.**
- `components/app/settings/logo.tsx:69` calls `uploadImage` directly (the
  second upload site).
- The editor holds attachments as base64 data URLs; the forms upload them in
  `processImagesInHTML` just before submit and substitute remote URLs.
- Paste and drop (`use-minimal-tiptap.ts:144-185`) insert data URLs directly;
  only the toolbar path goes through `ImageViewBlock`, which reads an
  `uploadFn` (`image-view-block.tsx:176-179`) that is never configured.
- Every post and comment body is capped at **10,000 characters**
  (`z.string().trim().min(1).max(10000)` in `trpc/create-feedback-post.ts:10`,
  `create-comment.ts:10`, `update-feedback-post.ts:10`, `update-comment.ts:9`,
  `app/api/feedback/create/route.ts:21`). A single 100 KB image is ~133,000
  base64 characters, so image bytes can never travel inside a body.
- The two edit components send raw editor HTML with no image processing
  (`feedback-post/edit.tsx:88-95`, `comment/edit.tsx:79-85`).

### One design: upload on insert, bodies carry references

**Every image reaches the server through `POST /api/images` and nowhere
else.** Bodies contain only `<img src="/api/images/<uuid>" width height>`
references.

- **Client.** One helper, `uploadEditorImage(file)` in
  `components/ui/minimal-tiptap/upload.ts`, is the `uploadFn` for the
  toolbar, **paste** and **drop** paths alike. The editor inserts a placeholder
  node, uploads, then swaps in the returned `src` and the image's **natural** `width`/`height`
  (today the editor stores the displayed size, `image-view-block.tsx:129-134`): `handleImageLoad` stops writing the rendered size and the resize handles (:70-75) are removed, so stored `width`/`height` stay natural. Submit and save are disabled while any upload is pending — `upload.ts` exports `hasPendingUpload(html)` (any `src="blob:`), which all four forms check, because the upload state lives in `ImageViewBlock`, out of the forms' reach; the server rejects `blob:`
  and `data:` sources, so a racing submit cannot silently drop an image.
  `transformPastedHTML` (it exists, `use-minimal-tiptap.ts:341-345`, with DOMPurify) is extended to strip `<img>` from pasted HTML (external images); a
  pasted image *file* goes through the helper.
- **Downscale before upload** (the helper, in the browser):
  `createImageBitmap(file, { imageOrientation: "from-image" })`, scaled so the
  longest edge is at most **2,000 px**, then re-encoded — JPEG (quality 0.85)
  for JPEG input, PNG for PNG input, WebP input to WebP where `toBlob` really
  produced WebP (Safari and iOS return PNG instead; the helper checks
  `blob.type`). JPEG and PNG are **always** re-encoded, which strips EXIF
  (including GPS). GIFs are uploaded untouched so animation survives, subject
  to the same byte cap. The editor's pre-insert checks — `filterFiles` (`components/ui/minimal-tiptap/utils.ts:179-206`, whose size test is `checkTypeAndSize`, :140-155), called by `extensions/file-handler/index.ts:36,61` (drop, paste) and `extensions/image/image.ts:226` (toolbar) — use a **25 MB input cap** in place of the two hard-coded `5 * 1024 * 1024` caps (`use-minimal-tiptap.ts:82,143`); a 4 MB cap there would refuse any phone photo before it was ever downscaled. `uploadEditorImage` checks the *downscaled* blob against `maxImageBytes` from the settings context (§10) before posting. The editor admits `image/*` (`use-minimal-tiptap.ts:81,142`): other types the browser can decode (AVIF, BMP, HEIC where supported) are re-encoded to JPEG, and anything `createImageBitmap` cannot decode — SVG included — is refused in the browser.
- **Logo.** `image-cropper.tsx` crops at source resolution with smoothing off
  and exports PNG; its output goes through the same helper (with smoothing
  re-enabled for the downscale) and is stored as `settings.logoImageId`.
- **Server bodies.** The shared sanitiser (`clean()` in `lib/utils-server.ts`) removes every `<img>` whose `src` is external or protocol-relative. A body with a `data:` or `blob:` source, or with `/api/images/<uuid>` for an id that does not exist, is **rejected** with 400, never silently stripped, and the form tells the author to wait for the upload or re-attach. The check runs on the raw input **before** `clean()`, whose default schemes would otherwise strip a `data:`/`blob:` `src` and store an empty `<img>` *(measured)*.
  Today external `https://` and `//host` sources survive sanitisation
  *(measured)*, and with the optimizer off they would render as tracking
  pixels on every board view.
- **References.** On every create and update of a post or comment, the server
  parses the saved HTML for image ids and replaces that owner's rows in
  `image_ref` in the same transaction. `processImagesInHTML` and
  `base64ToBlob` are deleted; nothing relocates them.
- **"Improve draft"** rewrites text only; images in the draft are preserved: the rewritten text replaces the draft's text, and the draft's image nodes follow it in their original order (today they are
  dropped, `feedback-form/index.tsx:53-58,91-98`).

### The endpoint

`POST /api/images` — multipart with one `file` part. Unauthenticated, because
anonymous posting is a feature, and therefore bounded:

1. Rate limit `images:ip` / `images:instance` (§1).
2. Reject a declared `Content-Length` above `MAX_IMAGE_BYTES` + 65,536 bytes
   of multipart framing (413), then **stream** the `file` part, counting bytes
   and aborting once it passes `MAX_IMAGE_BYTES`. Next 16 route
   handlers have no body-size limit of their own (only server actions do), so
   without this a request is fully buffered before any check.
3. Detect the type from **magic bytes** — PNG, JPEG (`FF D8 FF`), GIF
   (`GIF87a`/`GIF89a`), WebP (`RIFF…WEBP`) — and ignore the client's
   `Content-Type`. Anything else, SVG included, is 415.
4. Read dimensions with `image-size`; reject anything wider or taller than
   10,000 px or above 40 megapixels (422), a decompression-bomb guard.
5. If `MAX_IMAGE_STORAGE_BYTES` is set and the sum of stored bytes would exceed it, 507. Independently, images referenced by no post, comment or logo may total at most `MAX_PENDING_IMAGE_BYTES` (default 200,000,000): beyond it, 507. Without that bound, uploads that are never posted could fill the database before the 24-hour sweep — at the instance cap of 60 a minute, a 1 GB database in under five minutes.
6. Store; respond `201 { id, url: "/api/images/<id>", width, height }`.

`GET /api/images/<id>` — public (the board is public and images render inside
third-party frames). `Content-Type` is the stored detected type;
`Cache-Control: public, max-age=86400` (a day, so a removed image stops being served from caches within one); `ETag: "<id>"`, with 304
on `If-None-Match`; plus §2's `nosniff`, `Content-Disposition: inline` and
`default-src 'none'; sandbox` CSP. 404 for unknown ids.

`MAX_IMAGE_BYTES` defaults to **4,000,000 bytes** of decoded image data,
enforced on the server and mirrored in the client; it is a tightening of
today's 5 MiB. `MAX_IMAGE_STORAGE_BYTES` is unset (unlimited) by default and
recommended on small managed databases.

The same streaming byte cap protects the other public write paths:
`/api/trpc` and `/api/feedback/create` refuse bodies above 256 KB, and `/api/auth/*` above 64 KB (Better Auth buffers JSON bodies before any hook runs, and `name` is otherwise uncapped), before parsing (tRPC's `fetchRequestHandler` has no `maxBodySize`; only its node-http
adapter does).

### Serving: no optimizer, no `sharp`

Post bodies render images through `next/image` (via `html-react-parser` in
`components/ui/tiptap-output.tsx`), as do the logo and its settings preview —
three call sites (`tiptap-output.tsx:7`, `platform-header/title.tsx:8`,
`settings/logo.tsx:9`). Images are already right-sized at upload, so
`images: { unoptimized: true }` is set globally and the runtime needs no
`sharp`. `TiptapOutput` falls back to a plain `<img>` when a stored image has
no dimensions (today it passes `NaN`). `remotePatterns` is deleted along with
the Supabase host it bakes in. Avatars are not `next/image` (§3), which is why
dropping `remotePatterns` is safe.

`sharp` is still an optional dependency of `next` and is **traced into the
standalone output** whenever installed (it is skipped only on Vercel,
`next/dist/build/collect-build-traces.js:221-226`). The Dockerfile deletes
`.next/standalone/node_modules/sharp` and `…/@img` after the build and CI
asserts they are absent; `getSharp()` loads lazily and is never called with
`unoptimized: true`. Omitting optional dependencies at install time is
**not** an option: it also drops `@next/swc-*`, the Tailwind engine,
`lightningcss` and `rolldown`, and the build fails *(measured with a dry run)*.

### Orphans

Image references are `<img src>` substrings in HTML, so orphan detection by
text search would be an unindexable scan. Instead:

- `image_ref(imageId, postId, commentId)` — one row per (image, owner),
  `CHECK` exactly one owner, both owner FKs `ON DELETE CASCADE`, recomputed on
  every create and update. One image may be referenced by several bodies; an
  edit that removes an image removes its row.
- `settings.logoImageId` references `images(id) ON DELETE SET NULL`.
- The housekeeping sweep (§6) deletes images that have **no** `image_ref` row,
  are not the logo, and are older than **24 hours** — the grace period that
  keeps an image uploaded into an unsubmitted draft alive long enough to be
  submitted. A draft left open for more than a day before submitting loses its
  unreferenced images; the server then refuses the unknown ids and the form
  tells the author to re-attach.
- A body referencing an id that does not exist is rejected, so ids cannot be
  guessed into existence.

Deleting a post or comment also deletes, in the same transaction, every image that loses its last `image_ref` and is not the logo, so removing abusive content removes its images at once rather than after the sweep.

### Storage lives in the database — and the cost is printed

Every screenshot is Postgres bytes. The database and every `pg_dump` grow with
attachments; Render's free Postgres is a fixed 1 GB, and a paid Render
database's storage is billed separately (§8). The downscale keeps the number
reasonable; `MAX_IMAGE_STORAGE_BYTES` puts a ceiling on it. §11 documents
both.

## §5 — AI: optional, through OpenRouter, and honest about itself

AI goes through **OpenRouter only**. One OpenRouter account reaches every major
model family — Google, OpenAI, Anthropic, Meta, Mistral and more — including the
embedding model search needs; it reports the exact cost of every call; and it
has a per-request privacy switch. One provider therefore covers everything the
board does, and having only one is what makes turning AI on a single button:
there is no provider to choose, no endpoint to enter and no model to find.
Local models and other providers are not in v1 (Non-goals). What is locked in is
the gateway, not the model: any model OpenRouter lists can be chosen, and
`lib/llm/` is the only module that knows OpenRouter exists. It speaks plain
OpenAI-compatible HTTP, so adding another endpoint later is a contained change.

### Today, precisely

- There are **six** model call paths: five raw `fetch` calls to
  `https://openrouter.ai/api/v1` — `lib/utils-server.ts:39` (embeddings),
  `lib/utils-server.ts:125` (moderation), `queries/create-feedback-post.ts:50`
  (title and category), `trpc/generate-insights.ts:254`,
  `trpc/rewrite-feedback.ts:38` — and Ask-AI (`app/api/chat/route.ts`), which
  uses `createOpenRouter` from `@openrouter/ai-sdk-provider` with
  `providerOptions.openrouter.{reasoning, cacheControl}` (:237-246, :269-271).
  There are no others in the tree.
- The key is read from `OPENROUTER_API_KEY`, and a keyless instance sends
  `Bearer undefined` to openrouter.ai.
- Moderation treats every non-answer as a violation:
  `if (!content) return true;` (`lib/utils-server.ts:149`), which callers turn
  into `throw new Error("inappropriate-content")`. **A key that runs out of
  credit rejects every comment and edit as "inappropriate".** A keyless *post*
  fails differently — `Promise.all` rejects on a `TypeError` reading
  `data.choices[0]` (`create-feedback-post.ts:80,108-117`) and the form shows
  "Something went wrong" — but it fails all the same.
- Edits call moderation and re-embedding and throw the same way
  (`queries/update-feedback-post.ts:46-56`, `update-comment.ts:43-53`), and do
  so **inside** a database transaction (`:26-72`, `:24-67`), holding a pooled
  connection for the duration of a model call.
- Search is purely vector-based. Board search forks on `isSearching` for both
  its ordering and its cursor; the activity feed is a separate UNION search
  that filters `distance < 0.4` and pages by `OFFSET`. Both thresholds are
  hard-coded for Gemini embeddings (`get-feedback-posts.ts:32`,
  `get-activity-feed.ts:43`).
- The request bodies carry provider-specific fields: `reasoning` (four
  sites), `task_type` (embeddings — a Gemini parameter that OpenRouter does
  not document), `response_format: { type: "json_object" }` (moderation,
  titles **and insights**), `reasoning.exclude` (insights).
- The embedding request sends **no dimension**, and the default model
  `google/gemini-embedding-001` returns 3,072 values.

### One client, `lib/llm/`

Every model call goes through one module; call sites never build a request.

- **One fixed endpoint.** Every request goes to `https://openrouter.ai/api/v1`,
  a constant in `lib/llm/constants.ts` together with OpenRouter's `/auth` URL.
  There is no base-URL setting anywhere, so the key can only ever be sent to
  openrouter.ai, and an admin session cannot point the server at an internal
  address.
- **Transport: `@ai-sdk/openai-compatible`, pinned exactly to `3.0.48`**, created once with that base URL, the name `openrouter` and no `apiKey`: the key is passed per call as `headers: { Authorization: "Bearer …" }` *(measured for chat and embeddings)*, so a new key or **Remove key** takes effect on the next call. Its dependencies are
  exactly the `@ai-sdk/provider@4.0.14` and `@ai-sdk/provider-utils` that
  `ai@7.0.99` already uses (3.0.57 pulls a second copy of `@ai-sdk/provider`).
  It speaks `/chat/completions` and `/embeddings`, accepts `dimensions` for
  embeddings, and passes request-level `providerOptions.openrouter` into the
  chat request body; embedding bodies are built from a fixed list (below). It
  is used rather than OpenRouter's own `@openrouter/ai-sdk-provider` (3.0.0 is in
  the tree today) because every request shape this plan depends on —
  `dimensions`, the part-level cache breakpoint, `provider` on embeddings, the
  per-call cost — is measured against it, and a plain OpenAI-compatible
  transport keeps OpenRouter-specific code down to the few fields named here.
  `@openrouter/ai-sdk-provider`, `@ai-sdk/openai` and `@ai-sdk/google` are
  removed; `@ai-sdk/openai` would in any case call the Responses API
  (`POST /v1/responses`) *(measured)*.
- **`lib/llm/fetch.ts`** is passed as `createOpenAICompatible({ fetch })`. It
  sets `redirect: "manual"` and treats any 3xx as an error (the SDK otherwise
  follows redirects *(measured)*); it merges the privacy `provider` object into
  every `/embeddings` body, which the SDK would otherwise drop *(measured)*; and
  no response body it returns is passed to anything that reaches a browser. The provider is created with `includeUsage: true`. `lib/llm` sends none of
  `HTTP-Referer`, `X-OpenRouter-Title`, `X-Title`, `X-OpenRouter-Categories`
  or `X-OpenRouter-App-Visibility`: without `HTTP-Referer`, OpenRouter creates
  no app page and attributes no usage to one (its app-attribution docs).
- **No hidden retries.** Every `generateText`, `streamText`, `embed` and
  `embedMany` call passes `maxRetries: 0`. The SDK's default retries 408, 409,
  429 and 5xx twice with a 2-second backoff and honours `Retry-After` under
  60 s (`ai/dist/index.js:434,2791-2813`), which would make one counted call up
  to three requests and add about 6 s to a post during an outage *(measured)*.
  The only retries are `lib/llm`'s own: moderation's text-only retry, the
  backfill backoff, the live check's single data-policy retry, and
  `Retry-After` on `openrouter_in_flight_budget`.
- **Output caps.** Every call sets `maxOutputTokens` from `defaults.ts` —
  moderation and titles 1,024, rewrite 2,048, an insight chunk and an Ask-AI
  answer measured in phase 6 (`scripts/measure-ai.ts`, § *Turning AI on*).
  They bound the worst-case cost (§ *Bounding cost*) and OpenRouter's in-flight
  budget, which for newer accounts holds the completion tokens `max_tokens`
  allows, or a fixed per-request cap when it is unset.
- **No string model ids.** The `ai` package resolves a bare string model id
  through `@ai-sdk/gateway` to Vercel's AI Gateway (`ai-gateway.vercel.sh`).
  `lib/llm` always passes provider model objects and sets
  `globalThis.AI_SDK_DEFAULT_PROVIDER` to its own provider at load, and CI
  fails on any `generateText`/`streamText`/`embed` call outside `lib/llm`.
- **Configuration comes from the admin panel or the environment.** Admins set
  it in Settings → AI (§ *Turning AI on*), stored in `ai_settings` (§6); each
  variable, when set, overrides its field and locks it. `lib/config.ts`
  resolves it per request from a copy cached for 5 seconds in the runtime state
  (§6); a save invalidates the saving process's copy at once, and every other
  process and replica follows within 5 seconds:

  ```
  field(x)          = env ?? ai_settings.options.x ?? default (lib/llm/defaults.ts)
  apiKey            = OPENROUTER_API_KEY ?? the stored key
  aiConfigured      = ai_settings.enabled === false ? false      // Turn off AI beats the environment
                    : OPENROUTER_API_KEY set || (ai_settings.enabled === true && a stored key)
  chatModel         = field(model)             default google/gemini-3.8-flash
  embeddingModel    = field(embeddingModel)    default openai/text-embedding-3-small; "none" disables
  keyReadable       = apiKey is not a stored one, or it decrypts
  keyUsable         = lastCheck.key ∉ {invalid, management, expired}   (lastCheck is ignored unless its last4 is the current key's)
  hasChat           = aiConfigured && keyReadable && keyUsable
  hasEmbeddings     = aiConfigured && keyReadable && keyUsable && embeddingModel !== "none"
                      && probeVerified && (indexFingerprint == null || indexFingerprint matches)   (§ Embeddings)
  budget(feature)   = dailyCallLimit for moderation, floor(0.8 × dailyCallLimit) otherwise
  failing(c)        = health[c].failingSince older than 15 min && health[c].lastFailureAt within 10 min   (c: chat | embeddings)
  capabilities.chat = hasChat && today's count < budget(rewrite) && !failing(chat)
  errorCode         = !aiConfigured → AI_NOT_CONFIGURED;
                      !keyReadable || !keyUsable || failing(chat) → AI_UNAVAILABLE;
                      past the feature's budget → AI_PAUSED
  ```

- **OpenRouter's fields, in one place.** `reasoning` (four sites),
  `reasoning.exclude` (insights) and `response_format: { type: "json_object" }`
  (moderation, titles and insights) are sent as today, through request-level `providerOptions.openrouter` and nothing else — the SDK's top-level `reasoning` option emits `reasoning_effort` instead, and `Output.json()`/`Output.object()` throw `NoObjectGeneratedError` on a fenced reply *(measured)*, so neither is used; `task_type` (a Gemini parameter OpenRouter does
  not document) is dropped. Every JSON reply is parsed fence-tolerantly (the
  existing `stripCodeFence`) and validated with Zod, because the admin can pick
  any model and not every model honours `json_object`.
- **Timeouts.** `AI_TIMEOUT_MS` (default 15,000) per request for moderation, titles, embeddings and rewrite; insight chunks get six times that. Each is passed as `abortSignal: AbortSignal.timeout(ms)`: `embed` and `embedMany` ignore a `timeout` option *(measured)*. Ask-AI's stream is aborted when no token arrives within `AI_TIMEOUT_MS`.
- **Errors never log content.** `streamText`'s default `onError` is
  `console.error(error)`, which on a 401 logged the **entire prompt** —
  the board corpus and a user's email address *(measured)*. Every call passes
  an `onError` that logs status and message only. Insight errors stop
  embedding up to 500/200 characters of raw provider output into messages that
  reach an admin's browser (`trpc/generate-insights.ts:286,302`); they carry a
  status and a short message.
- **Ask-AI** keeps its tuned behaviour — reasoning effort and the explicit
  cache breakpoint, which the route's own comments show matter (the lowest
  reasoning level miscounts; without the breakpoint caching fell to nothing).
  Reasoning passes through request-level `providerOptions`. The cache
  breakpoint does **not**: `openai-compatible` reads message- and part-level
  fields only from `providerOptions.openaiCompatible` and emits them
  message-level, so an `openrouter` key is silently dropped *(measured)*. The
  breakpoint is therefore written by `createOpenAICompatible({
  transformRequestBody })`, which rewrites the system message to
  `content: [{ type: "text", text, cache_control: { type: "ephemeral" } }]` —
  the part-level shape today's OpenRouter provider emits. It acts only on a body carrying `feedbackland_cache: true` (sent through `providerOptions.openrouter`, which the SDK spreads into the body *(measured)*) and deletes that field, so moderation, titles and rewrite get no breakpoint; Verification 12 asserts the request body. It sends the 300 most recent posts
  (`ASK_AI_MAX_POSTS`), descriptions cut at 400 characters — about 45,000
  tokens (`lib/ask-ai.ts:7-18`), unchanged. Its request body is capped at 1 MB.

### Moderation: allowed, refused, or unavailable

Moderation gains a third outcome. **Unavailable is never a content ban.**

| Provider response | Outcome |
|---|---|
| a valid verdict | allowed or refused |
| an input-caused 4xx (400, 413, 415, 422) — e.g. a text-only model given an image | retry once **text-only**; then as below |
| a 403 whose `error.metadata.error_type` is `content_policy_violation` or `refusal`, or a reply whose raw finish reason is `content_filter` — the provider's own filter declined it (a Gemini `SAFETY` block, say) | **refused** (logged with the provider's name, never the text) |
| 401, 402, 403 (other), 404, 429, 5xx, any other non-input status, a 200 whose body carries `error`, a raw finish reason `error`, timeout, network error, unparseable reply | **unavailable** |

Unavailable degrades to the keyless path: the content is stored as written,
the event is logged, and the item is recorded in `moderation_event` with a mapped reason (§6): 401, or 403 whose `error_type` is `authentication` or `permission_denied` → `provider-auth`; 402 → `provider-credit`, except `openrouter_in_flight_budget` → `provider-rate`; 429 → `provider-rate`; 404, any other 403, 5xx, any other status, a 200 whose body carries `error`, a raw finish reason `error`, a timeout, a network error, an unparseable reply or a failed text-only retry → `provider-error`; a limiter error → `limiter-error`; the full daily limit → `daily-limit`. Status, `error.code` and `error.metadata` are read with `JSON.parse(APICallError.responseBody)`, because the SDK's parsed `data` drops `metadata`, and a 200 whose body is only `error` surfaces as an `APICallError` with status 200 *(measured)*. A stored key that no longer decrypts while AI is on also takes *unavailable* (not the keyless path), as `key-unreadable`; Activity's **Unscreened** filter lists those items and the
System panel counts the last 24 hours (§ *Telling the admin*). There is no
"hold for review" mode: v1 has no moderation queue to hold into. **This is an
explicit bypass:** anyone who can exhaust the operator's quota *at OpenRouter* (the key's spend limit, or the account's credit) turns moderation off until it resets. The rate limits bound how fast that can happen; nothing
else is claimed. The board's own daily limit is not such a bypass: at it,
anonymous posts are refused instead (§ *Bounding cost*).

Images are **inlined** as base64 exactly as stored (at most 4 per item, each at most `MAX_IMAGE_BYTES`, §4; browser uploads are at most 2,000 px, while GIFs and direct `POST /api/images` uploads may be up to 10,000 px, and an input-caused 4xx then retries text-only; GIFs are not sent). They are never re-encoded on the server — the runtime has no image
codec, deliberately (§4) — and never passed as URLs: stored URLs are relative (§4), private
boards are unreachable, and asking a provider to crawl the instance contradicts
the privacy position below. Images are sent only when vision is on (Settings → AI → Advanced; by default whenever the chosen model reads images, § *Turning AI on*); a text-only model moderates the text.

Edits call the models **outside** the database transaction: permission check in one transaction, model calls, then the update (the new text with `embedding = null` and `"updatedAt" = now()`), then `writeEmbedding`. A create inserts with `embedding = null` and writes its vector through `writeEmbedding` with `$seen` set to the inserted `updatedAt`.

### Keyless behaviour

| Surface | With AI | Without |
|---|---|---|
| Create post | moderation, AI title and category, embedding | title = first sentence of the plain text, truncated to 80 characters, or "Untitled feedback" for an image-only post; category `general feedback`; **no moderation**; `embedding` null |
| Create comment | moderation, embedding | stored as written |
| Edit post / comment | moderation, re-embedding | stored as written |
| Board search | vector similarity, distance cursor | `ILIKE` over `title` + `plainText` |
| Admin activity search | vector similarity over posts ∪ comments | `ILIKE` over the same UNION, offset-paged |
| Insights, Ask-AI, "improve draft" | shown | **In the admin area**, Insights and Ask AI stay in the navigation and open on an explanation of what they do, with the one next step (§ *Telling the admin*). **On the board and in the drawer**, "improve draft" is simply absent — visitors are never told about AI. Everywhere, `/api/chat`, `startInsightsRun` and `rewriteFeedback` return a typed `AI_NOT_CONFIGURED` error — or, once the daily limit's 80% share is used, `AI_PAUSED` with the resume time (Insights and Ask AI say "Paused until <local time>", with **Raise the daily limit**, § *Bounding cost*); while the key is unusable or OpenRouter is failing, `AI_UNAVAILABLE` ("AI needs attention — <reason>", with **Reconnect OpenRouter** when the key was rejected or can't be read, otherwise **Test again**) |

Model output is validated, not trusted: `title` is `NOT NULL` and `category`
is an enum, so an answer like `"Idea"` from a small model would otherwise make
Postgres reject the insert. An invalid reply takes the keyless path for that
field.

**Keyless means no content moderation at all.** A keyless board's defences are
the rate limits and an admin with a delete button. No word list is added.

**The `ILIKE` fallback searches plain text, never HTML.** `feedback.description`
and `comment.content` are sanitised HTML, and every uploaded image writes
`alt="Uploaded Image"`, so an `ILIKE` over markup would match "image", "png",
"href" and uuid fragments. `feedback` and `comment` therefore carry a stored
**`plainText`** column (created in `0001`, §6), written by all four create and
update paths from `getPlainText` with link targets dropped (`ignoreHref`).
User input has `%`, `_` and `\` escaped. The board search's `ILIKE` branch
falls into the non-search `else` arm wholesale (ordering *and* cursor), because
the `isSearching` fork covers both. The activity feed gets its own `ILIKE`
branch including `comment.plainText`.

When `hasEmbeddings` is true but a query embedding fails, the search cap trips (§1) or the daily budget refuses the call, search falls back to `ILIKE` rather than returning nothing.

### Embeddings and dimensions

The column's width must equal what the model returns, and that holds only if
every request **asks** for that width.

- **`AI_EMBEDDING_DIMENSIONS`**, default **768**, sizes the column at the first
  migration (§6). Every embedding request sends **the column's width** as
  **`dimensions`** — read from `pg_attribute` at boot and after a rebuild, and
  held in the runtime state — so after **Rebuild at N** requests ask for N. A
  later `AI_EMBEDDING_DIMENSIONS` that differs from the column prompts a
  rebuild; it never changes requests on its own. Without `dimensions`, today's
  model (`google/gemini-embedding-001`) returns 3,072 values into a 768 column
  and every embedding is discarded.
- **The default embedding model is `openai/text-embedding-3-small`**, because OpenAI documents `dimensions`, 768 included, for its `text-embedding-3` models. OpenRouter's catalogue lists `supported_parameters: []` for every embedding model, so it is no evidence either way; whether OpenRouter forwards `dimensions` is settled by phase 6's gate. Phase 6's gate requests 768 from
  the default and checks that 768 values come back. Advanced accepts any other
  OpenRouter embedding model id; the live check verifies that it returns the
  index's width, and switching to it means a rebuild (below).
- **768 is the default because it is cheap and enough.** It is a documented
  output width of OpenAI's `text-embedding-3` models; at 768 plain `vector` is
  used and its HNSW index fits pgvector's 2,000-dimension limit, so `halfvec`
  and pgvector 0.7.0 are not required. Asking for more than a model's native
  width returns the native width, which the length guard below catches. An
  operator who wants more sets the variable before first boot; above 2,000 the column is `halfvec`, and 4,000 is the ceiling, pgvector's HNSW limit (§6).
- **Similarity threshold.** `AI_SEARCH_MAX_DISTANCE` replaces the hard-coded
  0.4, which was tuned for Gemini. Its default is measured in phase 6 with
  `openai/text-embedding-3-small` at 768 dimensions over
  `scripts/fixtures/search-corpus.json` (every related pair found, every
  unrelated one excluded) and written into `lib/llm/defaults.ts`.
- **Verified at boot and on every change, never fatal.** After the server
  starts, and whenever the AI configuration changes, a background probe embeds
  a fixed string (timeout `AI_TIMEOUT_MS`) and compares the length with the
  column. A wrong length **disables embeddings for the process** — posting continues, search falls back to `ILIKE`, and the probe's `AI:` log line and the System panel name both numbers and the fix. The probe's result lives in the runtime state
  (§6), where request handlers can see it. An unreachable OpenRouter, a timeout or a 5xx marks embeddings *unverified*, and a 401, 402 or 403 records *failed: <reason>*; either way the probe retries on the backfill's backoff (5 s, 30 s, 2 min, then every 10 minutes, run from the 5-second backfill loop) and at once on a configuration change or a passing live check, so a board whose credit ran out recovers without a restart. Each process re-probes whenever its cached configuration changes (a hash of the key's last four characters, the models and the index width);
  the live check seeds the saving process's probe. **Nothing about AI can stop
  the board from starting**; an earlier revision refused to boot, which made an
  optional feature a hard availability dependency and crash-looped under
  `restart: unless-stopped`.
- **A length guard on every write and query** discards a wrong-length vector
  (writing `null`) and logs loudly; a wrong-length *query* vector would
  otherwise throw `different vector dimensions` *(measured)*.
- **Changing the embedding model always needs a full re-embed**, even at the
  same width: vectors from different models are not comparable.
- **The index remembers what built it.** `ai_settings.indexFingerprint` =
  `{ model, dimensions, generation }` is written when the first embedding is
  stored into an empty index, and by every rebuild. When the configured model
  or width — from the page or the environment — differs from it, indexing and
  semantic search stop, and the AI page, the banner and the System panel say
  "The search index was built with <old>; rebuild it for <new>". Every embedding write carries the generation it was computed under and is dropped if the generation has changed. `lib/llm/settings-store.ts` owns both statements that touch `ai_settings` for this: `writeEmbedding(db, table, id, vector, fingerprint, seen)`, the one statement that writes a vector — `UPDATE … SET embedding = $v WHERE id = $id AND "updatedAt" = $seen AND EXISTS (SELECT 1 FROM ai_settings WHERE id = 1 AND "indexFingerprint" = $fp FOR SHARE)`, plus `AND embedding IS NULL` for backfill writes, where `$fp` is the `{ model, dimensions, generation }` the vector was computed under (a `jsonb` equality). A process that saw no fingerprint computes under generation 1 and first runs, in the same transaction, `UPDATE ai_settings SET "indexFingerprint" = $fp WHERE id = 1 AND "indexFingerprint" IS NULL`, so the first write into an empty index seeds the fingerprint; a concurrent first writer with the same configuration then matches it, and a replica on another model cannot mix in *(measured on Postgres 17.5: nine cases, including concurrent first writers with the same and with different models, a write blocked behind a rebuild, and an edit between computing and writing)* — and `rebuildIndex(trx, …)`, which bumps the generation first, in the same transaction that nulls the columns. An edit writes its new text with `embedding = null` and `"updatedAt" = now()`, then its vector with `$seen` set to that `updatedAt`. So an in-flight write either commits before the rebuild (and is nulled by it) or waits and is dropped. A plain subquery without `FOR SHARE` let a stale vector through: under `READ COMMITTED` the blocked write re-checks only the row, not the subquery *(measured)*. So a batch in flight during a rebuild, or computed by a replica still holding the old configuration, cannot mix into the new index.

### Backfill and rebuild, without a terminal

- **Backfill is automatic.** While `hasEmbeddings` is true and rows have a null
  embedding, the housekeeping loop (§6) embeds them in batches of up to 64
  inputs per request (`embedMany`) every 5 seconds, within the daily limit's
  80% share — a 1,000-post board is searchable in about a minute and a half,
  and the AI page's progress bar counts the rows still to do. Posts created
  while keyless, or during a provider outage, become searchable on their own.
- **One bad row cannot stall it.** Rows with no embeddable text (an image-only
  comment) are never sent and are marked `embeddingSkipped` (§6; cleared by an
  edit, a rebuild or a model change). A batch answered with an input-caused 4xx
  is halved, down to single rows; a row that still fails is marked skipped and
  counted in the System panel ("3 items can't be indexed"). On 401, 402, 403, 404, 429, 5xx, any other non-input status or a timeout the loop backs off — 5 s, 30 s, 2 min, 10 min — and
  resets on success or a configuration change. The embedding input is the title and `plainText`, cut to 24,000 characters (inside the default model's 8,192-token context), so a long post is indexed rather than skipped. A backfill write lands only while the row is still null and unedited (`writeEmbedding`'s `embedding IS NULL AND "updatedAt" = $seen`, § *Embeddings*), so a vector computed from old text cannot overwrite an edit; an edit whose re-embedding fails leaves `embedding = null` for the backfill to redo. For that comparison to work, `feedback."updatedAt"` and `comment."updatedAt"` are `timestamptz(3)` — at microsecond precision a value read back through a JS `Date` never matched, 0 of 5 *(measured)* — and every edit sets `"updatedAt" = now()`, which today's `queries/update-*.ts` never do.
- **Rebuild is a button**, in the System panel and under Settings → AI →
  Advanced, and it asks first ("The search index will be rebuilt: 500 posts
  and comments, about 8 embedding requests, about a minute"). It increments the
  fingerprint's generation, nulls every embedding and clears
  `embeddingSkipped` (the backfill then refills them); when the width changes
  it first drops the HNSW indexes, alters both columns to the new type
  (`USING NULL`) and recreates the indexes in one transaction, which locks
  `feedback` and `comment` while the columns are rewritten (the button says
  so). **Rebuild at N** is offered at any N when `AI_EMBEDDING_DIMENSIONS` is unset and only at its value when it is set; N ≤ 4,000, and above 2,000 only on pgvector ≥ 0.7.0 (`halfvec`);
  otherwise the page says why it is not offered.
  This is the only supported way to change models or dimensions.

### Insights run in the background

`generateInsights` today is one synchronous request of up to 300 seconds
(`app/api/trpc/[trpc]/route.ts:5-8`, a Vercel `maxDuration`). Cloudflare's
proxy caps requests at 100 seconds and Railway cuts idle streams at five
minutes. On a long-lived server this is a job, not a request:
`startInsightsRun` inserts an `insight_reports` row with `status = 'running'`
and returns its id (a start while a run is `running` returns that run's id instead); the work runs in the server process and updates
`heartbeatAt` every 30 s; the page polls `getInsightsRun`. A run whose `heartbeatAt` is more than five minutes old is marked `failed` by the housekeeping loop (every 60 s) and by boot, and `getInsightsRun` reports such a row as failed, so a run cut short by a quick restart cannot stay `running`. `trpc/generate-insights.ts` is deleted; its body moves to
`lib/llm/insights.ts`. Both `maxDuration` exports are deleted.

### The dependency audit

Every package below has zero source references once the deletions in this
document are done (verified per package, 2026-09-26). † = in use today,
orphaned by a specific deletion.

| Package | Why it goes |
|---|---|
| `@openrouter/ai-sdk-provider` †, `@ai-sdk/openai`, `@ai-sdk/google` | replaced by `@ai-sdk/openai-compatible` |
| `@supabase/supabase-js` †, `firebase` †, `firebase-admin` † | vendors removed |
| `penpal` † (root; the widget's copy is already unused, §9) | §2 deletes its only consumer |
| `next-safe-action` † | §3 |
| `@next/bundle-analyzer`, `geist`, `zustand`, `he`, `@types/he`, `dequal`, `react-device-detect`, `unique-names-generator`, `cross-env` | already unused |
| `@tanstack/react-query-devtools`, `canvas-confetti`, `@types/canvas-confetti`, `recharts`, `rehype-pretty-code`, `rehype-stringify`, `remark-parse`, `remark-rehype`, `tailwindcss-animate` | already unused |
| `kysely-ctl` (dev) | its scripts are replaced (§6) |
| `uuid` (widget only) | its sole consumer validates `platformId` (§9). The root `uuid` stays: `isUuidV4` is used by `options-menu.tsx`, `feedback-posts/index.tsx` and `global-org-state/index.tsx:39-47` (renamed `board-state`) |
| `@rollup/plugin-commonjs` (widget dev) | unused |
| the root `overrides: { "jose": "^5.10.0" }` | a workaround for Vercel's `--no-experimental-require-module` and firebase-admin's ESM-only `jose@6`; it would force `jose@5` under Better Auth, which needs `^6.2.3`. Removed in phase 1, with `better-auth`; CI asserts `npm ls jose` resolves 6.x (V7, phase 1) |

A further 26 `components/ui/*` files are imported nowhere, and with them
`react-day-picker`, `embla-carousel-react`, `cmdk`, `input-otp`,
`react-resizable-panels`, `react-textarea-autosize`, `vaul` and about eleven
`@radix-ui/*` packages. Phase 7 derives the exact list with a `tsc`-verified
sweep, deletes them, and records the files and packages in its PR.

**Added**, each in the phase that first needs it: `tsx` (dev, phase 0, runs
`scripts/*.ts`); `better-auth` 1.7.6 exact (phase 1, for the DDL); `playwright`
(dev, phase 2); `nodemailer` + `@types/nodemailer` and `oauth2-mock-server`
(dev) and `helmet` (dev, for `ci/helmet-host.ts`) (phase 4); `@ai-sdk/openai-compatible` 3.0.48 exact (phase 6). Removals
happen in the phase that orphans each package: `next-safe-action`, root
`penpal`, `kysely-ctl` and `overrides.jose` in phase 1; `firebase` and
`firebase-admin` in phase 3; `@supabase/supabase-js` in phase 5; the AI SDK
providers in phase 6; the already-unused packages and the `components/ui`
sweep in phase 7; the widget's `penpal`, `uuid` and `@rollup/plugin-commonjs`
in phase 8.

### The trust position, structural and checkable

| Claim | How it is true |
|---|---|
| The key never reaches a browser | It is typed or connected once and never returned — responses carry only its last four characters. It is stored encrypted (§ *Stored, not shown*) and read only by `lib/config.ts` and `lib/llm/`, which start with `import "server-only"` (§2) and so fail the build if a client module imports them |
| The key goes only to OpenRouter | The endpoint is a constant, not a setting, and redirects are refused (§ *One client*) |
| The key and user content are never logged | Every model call passes a status-only `onError`; no `console.*` on a model path; CI greps `lib/llm/` |
| Nobody else sees the key or the data | There is no Feedbackland server. Requests go from the operator's server to OpenRouter, which forwards each to a provider serving the chosen model; the privacy switch, on by default, limits that to providers that do not train on prompts, and the strict switch to endpoints that retain none; OpenRouter itself stores no prompts unless the account opts in, apart from an anonymous categorisation sample (its data-collection page) (§ *Turning AI on*) |
| Nothing phones home | No analytics or error-reporting SDK; Better Auth telemetry pinned off; string model ids (Vercel AI Gateway) impossible by construction; the Next.js **runtime** has no telemetry path (`Telemetry` is constructed only `if (opts.dev)`), and `NEXT_TELEMETRY_DISABLED=1` is set for `next build`, which does report. Until an admin connects OpenRouter or pastes a key, nothing contacts openrouter.ai — not even for prices. Verification 16 runs the container with egress blocked |
| It is the operator's account, limits and bill | They own the OpenRouter account, set the key's spend limit (the AI page shows it and links to it) and can revoke the key; the product adds its own daily limit and shows usage and cost, typical and worst case (§ *Bounding cost*) |
| Turning it off changes nothing they own | One click in Settings → AI, which also overrides environment variables; AI surfaces return to their explanations; posts and history stay |

**What is sent, and when** — everything below goes to OpenRouter
(openrouter.ai), directly from this server:

| Feature | What leaves the server | When |
|---|---|---|
| Moderation | the text, and up to 4 stored images if vision is on | every post, comment and edit |
| Title and category | the post text | every post |
| Search index | title and text | every post, comment and edit, and the backfill |
| Search | the query | each search |
| Insights | every post title and body | when an admin runs insights |
| Ask-AI | the board's posts and the question | each question |
| Improve draft | the draft text | only when the author asks |
| Embedding probe | a fixed string | once per process start, on each configuration change, and on retry |
| Connect OpenRouter | the one-time code and the verifier | when an admin connects |
| Live check | the key, a fixed prompt, a fixed string, and with vision one 8×8 image | when a key is connected or pasted, on **Test again**, while waiting for credit (every 15 seconds with the page open, otherwise every 5 minutes for 7 days), and on saves that change a model, the index width or privacy |
| Model list | the key, to `/api/v1/models/user` | when an admin opens the model picker, and when the AI page shows prices |
| Key status | the key, to `/api/v1/key` | when an admin opens Settings → AI, and every 5 minutes (with one model call) while `failing(c)` |

Per action: a post makes 3 model calls, a comment 2, an edit 2, a search 1
however many pages are read, the probe 1. While no key is configured nothing is
sent, except the connect exchange and the check of a key being entered.

### Turning AI on: one button, in the admin panel

AI is optional and **strongly encouraged**. The board works fully without it;
the product says clearly, to admins only, what is missing and how little it
takes. Turning it on is **one button**: **Connect OpenRouter** → sign in to
OpenRouter or create an account → **Authorize** → back on the board, with AI on.
There is nothing to choose — the models, the privacy setting and the limits all
have working defaults — and no restart and no terminal. An admin who already has a key pastes it instead: one paste, nothing else. A new OpenRouter account
needs a few dollars of prepaid credit before paid models answer; the page walks
the admin through that step and finishes by itself when the credit arrives.
Environment variables remain a supported alternative for operators who manage
configuration as code (§ *Stored, not shown*).

**Settings → AI** (`/admin/settings/ai`; the Settings page gains two
sections, *Board* and *AI*) is admin-only and first-party
(`requireAdminSession`, §3), and sets `metadata.referrer: "no-referrer"`, so the one-time code in its address never travels in a `Referer`.
A **status** line heads it in every state: "AI is off"; "AI is off — kept off by
Dana on 12 October"; "Connected — add credit to finish"; "AI is on —
<model>"; "AI is paused — today's limit is nearly used, so only screening runs;
everything resumes at <local time>" or, at the full limit, "…new anonymous posts
are paused until <local time>", each with **Raise the daily limit**; "AI needs
attention — <reason>" (§ *Bounding cost*).

**While AI is off**, the page is one screen:

1. **What it does, as outcomes** — the Activity card's four lines (§ *Telling
   the admin*) and "On your last 30 days (N posts, M comments), this would have
   cost about $Z" from the dated price snapshot (below; hidden while the board
   has no posts).
2. **Connect OpenRouter**, the one primary button: "Sign in or create a free
   OpenRouter account. It takes about two minutes, plus adding credit if the
   account is new."
3. **Already have an OpenRouter key? Paste it** — a disclosure with one field.
4. **Keep AI off**, quietly, below (§ *Telling the admin*).
5. **Advanced**, collapsed and available in every state: chat model, embedding
   model, vision, timeout, daily limit, the search index's width with
   **Rebuild**. Nothing in it needs touching to turn AI on.

When `OPENROUTER_API_KEY` is set, the page says "Configured on the server (`OPENROUTER_API_KEY`, ends in …a1b2)" in place of 2 and 3. While a key is stored or that variable is set, **Turn on AI** re-enables AI with that key (a live check, then on) instead of starting Connect, so turning AI back on never mints a second key.

**Connect OpenRouter**, step by step:

1. `connectOpenRouter.start` generates a `code_verifier` (S256), keeps it
   **encrypted** (`lib/secret-box.ts`, bound to the admin, § *Stored, not
   shown*) in an HttpOnly, `SameSite=Lax`, 1-hour cookie (`Path=/`; `Secure` exactly when `useSecureCookies` is, §3) together with the `ai_settings.updatedAt` it saw, and sends the browser, in the same tab, to
   `https://openrouter.ai/auth?code_challenge=…&code_challenge_method=S256&key_label=Feedbackland%20–%20<board name>&callback_url=<origin>/admin/settings/ai/return/<n>`, where `n` is 128 random bits kept inside the same encrypted cookie; the board name is truncated so `key_label` stays within OpenRouter's 100 characters.
2. On OpenRouter the admin signs in or signs up and presses **Authorize**;
   OpenRouter redirects back with `?code=`.
3. The return page (`/admin/settings/ai/return/<n>`), loaded with `?code=` and a pending-flow cookie for this admin whose `n` matches the path,
   removes the code from the address bar (`history.replaceState`) and calls
   `connectOpenRouter.finish` — a POST; nothing is exchanged on a GET. It
   exchanges the code at `POST https://openrouter.ai/api/v1/auth/keys { code,
   code_verifier, code_challenge_method: "S256" }` (single-use; expires after
   10 minutes; a bad code answers 403 in the documentation, 400 in practice),
   stores the key and runs the live check; AI is on (`enabled = true`) if it
   passes. If the check's chat call answers 402 `openrouter_credits`
   (`is_free_tier` only chooses the copy), `enabled` stays null and
   `creditWaitUntil` is set to `apiKeySetAt` + 7 days: posts keep taking the
   path without AI, so nothing fails, the pill reads "AI: add credit", and every
   nudge's button becomes **Add credit on OpenRouter**. The wait runs while
   `creditWaitUntil > now()`, `enabled IS NULL` and a readable key is stored;
   **Turn off AI**, **Keep AI off**, **Remove key**, a new key or a passing check
   ends it, and its results write `lastCheck`, never `health`. The credit
   screen and card also offer **Not now**, **Keep AI off** and **Remove key**. `finish` runs once per flow: the client guards it
   with a ref, the server claims `connect:<sha256(verifier)>` in `rate_limit` (`INSERT … ON CONFLICT DO NOTHING RETURNING key`; no row means it was already claimed — 20 concurrent claims gave one *(measured)*) and clears the cookie, and a repeat call returns
   the current status. If another admin changed the AI settings after `start`,
   `finish` refuses before exchanging ("Dana connected OpenRouter a moment
   ago"). A `?code=` without a pending flow exchanges nothing and says "That
   connection timed out — press Connect OpenRouter again (you're already signed
   in there)." OpenRouter defines no `state` parameter and documents `code_challenge` as optional, so a code minted *without* a challenge might exchange with no verifier; the path nonce `n` is therefore the state: `finish` called from the return page refuses before exchanging unless the path's `n` matches the cookie's. The cookie also records the flow's mode, and a headless flow — whose code is pasted, never delivered by a redirect — accepts a code only from the paste field. Phase 6 records whether `/api/v1/auth/keys` rejects a verifier for a challenge-less code.
4. The page says "AI is on" and what is now happening (below). If the account
   has no credit (step 3), it says instead: "Connected. One
   step left: add credit to your OpenRouter account — at today's prices $5
   covers about N posts", with **Add credit on OpenRouter** (its credits page,
   in a new tab). It re-runs the check every 15 seconds while the page is open, and otherwise the housekeeping loop re-runs it every 5 minutes for 7 days (§6) — a call refused for lack of credit costs nothing — so AI turns on by itself when credit arrives, whether or not the tab is open: "Credit received — AI is on". The page says "You can close this page." After 7 days the wait stops and the page says "Still no credit — press Test again once you've added it".

OpenRouter documents `localhost` callbacks on any port. The redirect is used
for `https:` origins and the hostname `localhost` (not `127.0.0.1`) — Render,
Railway, the TLS overlay and a local install — and OpenRouter's documented
**headless** mode everywhere else (plain HTTP at an IP address or LAN name):
no `callback_url`, and OpenRouter shows the code after **Authorize**. In
headless mode the button opens a new tab on the click (so popup blockers allow
it) and points it at `/auth` once `start` returns, and the current tab goes to
Settings → AI with "Paste the code OpenRouter shows you" focused; pasting
submits it to the same `finish`. A public `callback_url` makes OpenRouter create an app page for that address — public by default and not changeable afterwards; a `localhost` callback and headless mode create none (its OAuth and app-attribution docs). So on an `https:` origin other than `localhost` the redirect is used only when the board is itself public (`allowIndexing` on), and the button then says underneath "OpenRouter will show this board's address as the app that created the key", with **Connect without listing** (headless mode); a board with indexing off connects headlessly. Phase 6 records what that app page shows. The verifier
never leaves the server unencrypted, so someone watching a plain-HTTP
connection who sees the code still cannot exchange it. Phase 6 checks whether
`/auth` honours `limit` and `usage_limit_type` (OpenRouter's key-creation API
accepts them); if it does, Connect creates the key with a $10 monthly limit,
shown as "Monthly spend limit: $10 (change it on OpenRouter)", and otherwise
the page recommends setting one and links to the key's page.

**Paste a key**: one field. Pasting a key that starts with `sk-or-v1-` (or typing one and pressing Enter) checks it at once ("Checking…"); if it passes, AI turns on there and then, and the confirmation offers **Undo**, which restores the previous `apiKey`, `apiKeyLast4`, `apiKeySetAt` and `enabled` and records no "kept off". A key on an account without credit takes the credit step above. A key from another provider gets a specific answer instead of a
failure: an OpenAI (`sk-proj-`, `sk-svcacct-`, or legacy `sk-…` carrying the
`T3BlbkFJ` marker), Anthropic (`sk-ant-`) or Google (`AIza…`, `AQ.…`) key →
"That's an <OpenAI> key. Feedbackland uses OpenRouter, which gives you
<OpenAI's> models and every other major one through a single key", with
**Connect OpenRouter**; anything else → "OpenRouter keys start with
`sk-or-v1-`." Nothing is sent for a key that is not OpenRouter-shaped.

Every key and code field is `type="password"`, `autocomplete="off"` and
`spellcheck="false"` (browsers' enhanced spellcheck sends field text to the
vendor), and carries: "Only paste a key or code you created yourself, just now.
Nobody from Feedbackland or OpenRouter will ever send you one." On a page not served over HTTPS, the **key** field adds: "This page isn't served over HTTPS, so a key typed here travels unencrypted. Connect OpenRouter is safer here, or set
`OPENROUTER_API_KEY` on the server."

**While AI is on**, the page says what is happening, in sentences rather than a
checklist: "New posts and comments are screened for spam and abuse and get a
title and a category", "Search: 132 of 500 posts and comments indexed" (a live
progress bar while the backfill runs), "Insights and Ask AI are ready". Then
**Usage and limits**, **Privacy**, **Advanced**, **Turn off AI** (keeps the stored key; overrides the environment until an admin turns AI back on; also records `keepOffAt`/`keepOffBy`, so the nudges stay quiet, § *Telling the admin*), **Reconnect OpenRouter** and **Paste a new key** (each replaces the stored key; an unreadable key counts as none for **Turn on AI**) and **Remove key** ("Removed from this board. The key still exists in your
OpenRouter account — delete it there", linking the key's page). Each change is stamped with who made it and when; only admin actions write `updatedAt`/`updatedBy` — `lastCheck`, `health`, `indexFingerprint` and the credit wait never do, so a background write can never make an admin's save look stale. Saves carry the settings' `updatedAt`; a
save against a newer version is refused ("Dana changed these settings a moment
ago — reload").

**Defaults** (`lib/llm/defaults.ts`, fixed in phase 6 by `scripts/measure-ai.ts`, run by hand against real OpenRouter, with its output committed to `defaults.ts` and the PR): the chat model is the cheapest current model that gets every verdict in `scripts/fixtures/moderation-corpus.json` (20 allowed, 20 refused) right and returns valid JSON for 20 titles, trying candidates cheapest first (`google/gemini-3.8-flash` unless it fails); the same run records the output caps, the tokens per action for the dated price snapshot, and `AI_SEARCH_MAX_DISTANCE` — the midpoint between the largest related-pair and the smallest unrelated-pair distance over `search-corpus.json`, the run failing if they overlap; the embedding model is `openai/text-embedding-3-small`;
vision follows the chat model's `architecture.input_modalities` (on for the
default) and is re-derived when the model changes unless set explicitly. Under
Advanced the admin can pick any chat model the key can use from a searchable
list built from `GET /api/v1/models/user` (the models this key may use under its privacy settings), each with its price. Free (`:free`)
models are never a default: they allow 50 requests a day until an account has
bought $10 of credit, many vanish under the privacy switch, and a negative
balance returns 402 even for them.

**Prices.** With a key, they are read live from `GET /api/v1/models/user` (chat) and `GET /api/v1/models/user?output_modalities=embeddings` (embeddings; the public `/api/v1/models` lists none). While AI
is off — the off page, the Activity card, the credit step — figures come from
the release-time snapshot in `defaults.ts` (tokens per action measured on the
fixture corpus × the default models' prices on the release date) and are always
dated: "about $0.03 per 100 posts at September 2026 prices".

**The live check** (`trpc/test-ai-settings.ts`) runs when a key is connected or
pasted, on **Test again**, while waiting for credit, and on saves that change
the key, a model, the index width or privacy; other fields save without it, and
**Turn off AI** never runs it. It is recorded as usage (`check`), is **not**
refused by the daily limit (so an admin can verify a fix while AI is paused),
and is bounded by `ai-check:user` (10 per minute, shared with the model list and
Connect; the credit wait's 4 a minute fit inside it):

1. **Key**: `GET /api/v1/key`, which costs nothing and returns the key's usage,
   its spend limit and what remains, and whether the account has ever bought
   credit (`is_free_tier`); where OpenRouter reports them, also whether it is a
   management key and when it expires.
2. **Chat**: moderation's exact request (reasoning, `response_format`, `provider`) with the chosen model and `max_tokens: 64`; any 200 passes (the default model's reasoning is mandatory, so OpenRouter refuses `max_tokens: 0`, `lib/utils-server.ts:17-19`). With vision on, one 8×8 PNG is attached.
3. **Search**: one embedding requested at the index's width; the returned
   length is compared with it.
4. **The verdict**, per capability, in plain words. Failures map to actions,
   never to raw provider text:
   - 401 or "User not found" → "This key isn't valid."
   - A management or provisioning key → "This is a management key; it can't
     call models. Create a regular key, or use Connect OpenRouter." An expired
     key → "This key has expired." Within 7 days of expiry, an amber notice.
   - While AI is not yet on (Connect, a pasted key, **Turn on AI**), a chat call answering 402 `openrouter_credits` → the credit step above (`is_free_tier` only chooses its copy); on a key that is already on, the next bullet.
   - 402, by `error.metadata.limit_source`: `openrouter_credits` → "Your OpenRouter account is out of credit" (**Add credit**), or with `metadata.reason` `weight_exceeds_budget`, "This request is too large for your current OpenRouter balance — add credit";
     `openrouter_key_limit` → "This key has reached its spend limit" (link to
     the key's page); `openrouter_in_flight_budget` → retried after `Retry-After` (on the posting path it records `provider-rate`).
   - 404 for the model → "This model isn't available to your account."
   - 404 "No endpoints found matching your data policy" → "No provider for
     this model meets your privacy setting" (retried once first: it has been
     observed to be transient).
   - 429 → "OpenRouter is rate-limiting this key right now."
   - A timeout → "The model took longer than <timeout>. Test again, or pick a
     faster model under Advanced."
   - A network failure → "This server can't reach openrouter.ai — check its
     outbound network or firewall."
   - A wrong embedding length → "This model returns N values; your search
     index uses M", with **Use the default model** or **Rebuild the index at
     N** (§ *Backfill and rebuild*).

**Applying without a restart.** Saving writes `ai_settings` (§6) and
invalidates the saving process's cached configuration at once; every other
process and replica follows within 5 seconds (§ *One client*), and each process
re-probes the embedding model when its cached configuration changes (§ *Embeddings*) (the
live check seeds the saving process's probe). From the next request, new
content is screened, titled and indexed; existing posts and comments are
indexed by the backfill (§ *Backfill and rebuild*). Nothing re-screens or
re-titles content that already exists: flagging old posts would need a
moderation queue v1 does not have, and re-titling would change what authors
wrote. The page says so.

**Privacy.** **Only use providers that don't train on prompts** is **on by default** and sends `provider: { data_collection: "deny" }` — some such providers still keep prompts for a period for abuse monitoring (Google AI Studio, 55 days), which the page says; OpenRouter itself stores no prompts unless the account opts in, apart from an anonymous categorisation sample; **Zero
data retention (strict)**, off by default, adds `zdr: true`, so requests go only
to endpoints with a zero-retention policy (the default embedding model then
routes only through Azure, Gemini 3.8 Flash only through Vertex) and most free
models disappear. Chat requests carry `provider` in request-level
`providerOptions.openrouter`; `lib/llm/fetch.ts` merges the same object into
every `/embeddings` body (§ *One client*). `OPENROUTER_PRIVACY` (`deny`, `zdr`
or `allow`) sets and locks the switches for configuration-as-code operators. The
page states what each switch means, notes that OpenRouter's account-wide privacy
settings also apply (linking them), and repeats the *What is sent* table.

**Stored, not shown.**

- The key is written once — by Connect or through the form — and **never
  returned**: every response carries only its last four characters;
  `lastCheck` and `health` hold mapped reasons, never provider text.
- It is stored **encrypted** — `lib/secret-box.ts`, AES-256-GCM, format
  `v1.<base64url 12-byte random nonce>.<base64url ciphertext‖tag>`, with
  associated data naming what it protects (`ai_settings.apiKey` for the key;
  `connect-openrouter:<userId>` for the Connect cookie, which is what binds it
  to the admin), so a ciphertext cannot be moved to another column or user —
  and a key derived by HKDF-SHA-256 (input: the auth secret; empty salt; info
  `feedbackland:ai-key:v1`; 32 bytes). There is no re-encryption on rotation: if
  the auth secret changes, the stored key can no longer be decrypted, the page
  says "The stored key can't be read (the server's secret changed) — connect
  again", AI shows **needs attention**, and the failure is logged once per
  process per value. The honest limit: when the auth secret was **generated**
  (the default for Compose), it lives in the same database, so anyone holding a
  full backup can decrypt the key, just as they could impersonate any user. The
  protection that matters is a **spend limit on the key**, which the page shows
  (from `/api/v1/key`) and links to setting; when the secret is **injected**
  (Render generates one into the environment), a database dump alone does not
  reveal the key.
- After a key is pasted, the page shows its label and **Confirm it's yours**
  (`https://openrouter.ai/keys/<sha256(key)>`): "This opens only if the key
  belongs to the account you're signed in to. If it says not found, remove the
  key — prompts would go to someone else's account." The residual, stated: an
  admin can still paste a key someone else controls.
- **Environment variables win and lock** each field they set, shown read-only
  ("Set on the server by `OPENROUTER_MODEL`"); an environment key shows as "Configured on the server (`OPENROUTER_API_KEY`, ends in …a1b2)" and can be neither viewed nor replaced
  in the UI. **Turn off AI** still overrides them (`enabled = false`) until an
  admin turns AI back on.
- Only `lib/llm/settings-store.ts` reads or writes `ai_settings` — including the two statements that join it to the embedding columns, `writeEmbedding` and `rebuildIndex` (§ *Embeddings*); `lib/config.ts`, `lib/housekeeping.ts`, `lib/boot/` (its seed calls `ensureAiSettingsRow(trx)`) and the AI procedures call that module. CI fails if any file other than it, `db/migrations/` and the generated `db/schema.ts` names the table (like `instance_secret`'s rule).

### Telling the admin

The rules: **outcomes first, then the mechanism in terms that can be checked**
(the house copy rule — AI-forward hype reads as noise to this audience, so copy
says what the feature does before saying it is AI); **admins only** — never on
the public board, in the drawer or on the posting path; **visible but never in
the way** — no blocking dialogs, countdowns or scarcity, and every nudge
dismissible except one small status; **one action everywhere** — every nudge's button starts the one next step directly (Connect OpenRouter; **Add credit on OpenRouter** while waiting for credit; **Turn on AI** when a key is already stored) rather than leading to a settings page; **honest** about cost, privacy and limits; no ✅ comparison tables; and
**a "no" is respected**.

| Where | What |
|---|---|
| **Right after setup** (from phase 6b; phases 3–6a land on `/admin`) | `/setup` lands on `/admin/settings/ai?welcome=1`: "One more step, recommended: let the board do the sorting", the outcomes, **Connect OpenRouter**, "or paste a key", **Skip for now** (to `/admin`) and **Keep AI off** |
| **The admin header, every admin page** | a small status pill: "AI off" (neutral, with "Turn on", which starts the one next step — Connect, or **Turn on AI** when a key is stored; after **Keep AI off**, plain "AI off" with no action), "AI: add credit" (amber: connected, waiting for credit), "AI on", "AI paused" (amber: the daily limit), "AI needs attention" (red: an invalid, unreadable or expired key, no credit left, or OpenRouter failing for over 15 minutes). It links to Settings → AI and is the one element that is always present |
| **Activity** (the admin landing tab), while off | a card. Title: "Let the board do the sorting". Body: "Screen out spam and abuse before it's published, give every post a clear title and category, find posts by what they mean rather than the exact words, and see which requests have the most people behind them. Connecting an OpenRouter account takes about two minutes — plus a few dollars of prepaid credit if the account is new — costs about $X for every 100 posts at <month> prices, and you can turn it off at any time without losing anything." (The figure is the dated snapshot in `defaults.ts`, never a live lookup while AI is off; omitted when there is none.) Buttons: **Connect OpenRouter** · **Not now** (hides it for that admin for 14 days) · **Keep AI off** |
| **Insights and Ask AI**, while off | both stay in the admin navigation, with a small "off" marker, and open on their own explanation instead of disappearing. Insights keeps its existing first-run copy ("See what your feedback adds up to", which already explains what goes in and how themes are ranked) and adds "Insights reads and groups your posts with an AI model. Turn on AI to generate your first report." Ask AI: "Ask anything about your feedback — answered from your {min(N, 300)} most recent posts, with a link to every post it cites." Each has the one next step |
| **While waiting for credit** | the Activity card reads "Connected to OpenRouter — add credit to finish turning on AI" with **Add credit on OpenRouter**, the pill "AI: add credit", and every other nudge's button is the same **Add credit** |
| **In context**, while off | the Activity search field reads "Searching exact words · Search by meaning with AI"; when posts arrived that this admin has not seen (`activity_seen`), the Activity header reads "12 new posts since your last visit — AI screening is off", dismissible per admin like the card |
| **When it breaks** | a separate card, shown while `failing(chat)` or `failing(embeddings)` (§ *One client*; the same moment the pill turns red); **Not now** hides it until OpenRouter recovers and fails again. Its copy names the start and the mapped reason: "OpenRouter has been failing since 14:02 (the key was rejected); 3 posts were published without screening." → **Reconnect OpenRouter** when the key was rejected, otherwise **Test again**; for search, "Search has used exact words since 14:02". Activity gains an **Unscreened** filter listing the items recorded in `moderation_event` |
| **Operators** | the startup banner: "AI: off — turn it on in Settings → AI (`/admin/settings/ai`)" |

**Keep AI off** (on the card, the welcome step and Settings → AI) is an
instance-wide, stamped and reversible decision (`ai_settings.keepOffAt`,
`keepOffBy`, and `enabled = false`, so a later `OPENROUTER_API_KEY` cannot turn AI on behind it; turning AI on clears all three). Once chosen, the pill is a neutral "AI
off" with no action, the card and the in-context notices never show, and
Insights and Ask AI keep their explanations — for an operator whose policy
forbids sending content to a third party, the product stops asking. Per-admin
dismissals live in `admin_notice` (§6), written by
`trpc/dismiss-admin-notice.ts`. The pill, the cards and the off states read
`getAiStatus` (admin-only), which the admin layout
(`app/(board)/admin/layout.tsx`, which also calls `requireAdminSession`)
resolves on the server so they are right on first paint. The tab labels "Insights" and "Ask AI" are unchanged. The pill shows the first state that applies — kept off → no key → a key (stored or environment) while `aiConfigured` is false ("AI: add credit" while `creditWaitUntil > now()`, otherwise "AI off" with **Turn on AI**) → needs attention (an unreadable, invalid or expired key, no credit left, `failing(chat)` or `failing(embeddings)`) → paused (past 80% of the daily limit) → on. The three AI endpoints return § *One client*'s `errorCode`; a search-only failure shows on the pill and the card, not as an endpoint error.

### Bounding cost

- **One call is one HTTP request to OpenRouter** (an `embedMany` batch is one); with `maxRetries: 0` there are no hidden ones. `startInsightsRun` reserves its chunk count up front with `consumeAiBudget(cap, n)` (below, with `n` in place of 1) and is refused whole if it does not fit the 80% share, so a run never stops midway; its chunk calls then consume nothing further.
- **A daily limit**: `dailyCallLimit` calls per UTC day — default **5,000**
  (the phase-6 measurement states what that costs with the default models), set
  under Advanced, locked by `AI_DAILY_CALL_LIMIT`, and validated to be at least
  10 in both places (below that, the first call would always be admitted and the
  80% share could be zero). It is counted in the `rate_limit` row
  `ai:instance:day:<UTC date>`, consumed by `consumeAiBudget(cap, n = 1)` in
  `queries/check-rate-limit.ts`, which counts only **allowed** calls:
  `INSERT INTO rate_limit (key, count, "windowStart") VALUES ($key, $n, now()) ON CONFLICT (key) DO UPDATE SET count = rate_limit.count + $n WHERE rate_limit.count + $n <= $cap RETURNING count`
  — `$n` is 1 except for an insights run, and a call with `$n > $cap` is refused without a query; no row returned means refused, and a database error refuses the call. It runs on the pool in autocommit, never inside a transaction: a refused call inside one held the instance-wide row locked until commit and made every other AI call wait *(measured)*; `$cap` is an integer. A
  new UTC date is a new key, so the budget resets at 00:00 UTC exactly, and the
  §6 sweep never deletes today's key.
- **Moderation is reserved the last 20%.** Titles, indexing, search embeddings,
  insights, Ask AI and "improve draft" consume against
  `floor(0.8 × dailyCallLimit)`; moderation against the full limit. Past 80%,
  those features stop for the day — search uses exact words, new posts get
  first-sentence titles (permanently, for those posts) — and `capabilities.chat`
  turns false, so visitors never see an AI button that would fail.
- **At the full limit, anonymous posting and `POST /api/feedback/create` answer
  429 `DAILY_LIMIT`** ("New anonymous posts are paused until <local time> — the
  board's daily screening limit was reached"; the body is `{ code:
  "DAILY_LIMIT", resetsAt: "<ISO 8601>" }`, shown in the viewer's local time),
  per §1's rule that a post is never accepted without moderation to get around
  a cap. Signed-in posts, comments and edits are stored unscreened and recorded
  (`moderation_event`, reason `daily-limit`): they carry per-user caps and an
  author an admin can remove. The pill says "AI paused"; **Raise the daily
  limit** takes effect within 5 seconds (when `AI_DAILY_CALL_LIMIT` locks the
  limit, the button reads "Set on the server by `AI_DAILY_CALL_LIMIT`").
- **The cost, typical and worst**: the page states the typical cost ("about $X
  per 100 posts") and the worst case — `dailyCallLimit` × the cost of the
  largest single request (Ask AI's full context plus its output cap): "Worst
  case, if every call were the largest possible: $Y a day". It recommends a key
  limit with a monthly reset at or below that.
- **Usage you can read**: `lib/llm/usage.ts` records every call per feature per
  day in `llm_usage` (§6) — calls, tokens and the cost OpenRouter reports for
  every request, embeddings included, read from `steps[].usage.raw.cost` (chat)
  and `responses[].body.usage.cost` (`embedMany`), or `response.body.usage.cost` for a single `embed` — the query embedding and the probe *(measured field paths)*. The
  page shows today, this month and the last 30 days by feature. Costs are exact;
  nothing is shown that was not measured.
- **The key's own limit**: the page shows the key's spend limit and what
  remains (`limit`, `limit_remaining`), recommends setting one when there is
  none, and links to the key's page.
- **Search costs one call however many pages are read**: query vectors are
  cached per process for 10 minutes by (the query trimmed, lower-cased and with whitespace collapsed, and the index fingerprint),
  at most 1,000 entries — today every "load more" re-embeds the query
  (`queries/get-feedback-posts.ts:33`, `get-activity-feed.ts:47`).
- For scale: a post makes 3 model calls, a comment 2, an edit 2, a search 1;
  embedding 10,000 posts with the default model costs about four cents.

**Floods, stated.** Someone flooding the board can exhaust the day's limit.
At the default limit and §1's instance caps (240 anonymous posts a minute
across the board and the API, 3 calls each), about ten minutes of sustained
posting uses it up: after about six, titles and indexing stop; after about
ten, anonymous posting pauses until 00:00 UTC, and signed-in content is
published unscreened and recorded. About thirteen minutes of distinct
searches at the search cap uses up the 80% share, so semantic search and AI
titles stop for the rest of the day. A flood cannot make anonymous content
skip screening through the board's own limit; exhausting the key's spend limit
first (one set below the day's worst case) still can, as stated under
*Moderation*. The amber pill, `moderation_event` and **Raise the daily limit**
make it visible and recoverable; that trade — a hard ceiling on the operator's
bill against a posting pause under a sustained flood — is the operator's to
tune with the limit.

## §6 — Schema, migrations and boot

### What is deleted

`db/schema.sql` is a hand-trimmed Supabase dump that has never been runnable on
a fresh database: it references `"extensions"."halfvec"` on both embedding
columns and `"extensions"."halfvec_cosine_ops"` in both HNSW indexes, contains
no `CREATE EXTENSION`, inserts into `storage.buckets`, creates a policy on
`storage.objects`, folds in a data backfill (`UPDATE insights SET
"firstSeenAt" = "createdAt"`), and is not idempotent (five bare `CREATE TYPE`,
13 of its 16 `CREATE INDEX` bare, every `ADD CONSTRAINT`). It is deleted in
phase 1 together with `db/migrations/2026-07-25-insights.sql` and
`db/migrations/2026-08-10-security-hardening.sql` (idempotent, simply
superseded), `.config/kysely.config.ts`, the `migrate-make` / `migrate-up` /
`migrate-down` and `schema-dump` scripts, and `kysely-ctl`. The kysely-ctl
scripts were never configured (no `migrationFolder`, so they resolve a
nonexistent `<repo>/migrations`), would skip `.sql` files silently, and
`migrate-down` contradicts forward-only migrations. The `kysely-codegen`
script is renamed `db:codegen`.

### Migrations are TypeScript modules, registered statically

Kysely's `FileMigrationProvider` accepts only `.js/.ts/.mjs/.mts/.cjs/.cts`
and **silently skips** anything else: pointed at a folder of `.sql`,
`migrateToLatest()` returns `{ results: [] }` and no error *(measured)*. A
directory listing is also invisible to Next's file tracing. So migrations are
TypeScript modules, imported statically by a registry:

```ts
// db/migrations/index.ts
import * as m0001 from "./0001_init";
export const migrations = { "0001_init": m0001 } satisfies Record<string, Migration>;
```

`Migrator` is imported from **`kysely/migration`** (it is not exported from the
package root in Kysely 0.29 *(measured)*). Boot runs inside Next's server
bundle (below), so the migrations, Kysely and every dependency are bundled
like any other server code; nothing is read from disk at runtime.

**Until the tag `v1.0.0-rc.1` there is exactly one migration, `0001_init`,
edited in place**, and development databases are rebuilt when it changes.
From `v1.0.0-rc.1` on, migrations are append-only: release-candidate
databases on Render and Railway are real databases that later images must
upgrade. (An earlier plan numbered files by feature — `0002_images` written
after `0003_instance` — which Kysely rejects outright: `corrupted migrations:
expected previously executed migration 0003_instance to be at index 1 but
0002_images was found` *(measured)*.)

The tracking tables are Kysely's defaults, `kysely_migration` and
`kysely_migration_lock`; the lock table is created but unused on Postgres.

### The target schema (`0001_init`)

| Table | Definition |
|---|---|
| `settings` | `id integer primary key default 1 CHECK (id = 1)`, `platformTitle text not null default 'Feedback'`, `platformDescription text`, `logoImageId uuid references images(id) on delete set null`, `allowIndexing boolean not null default true`, `setupCompletedAt timestamptz` (null = unclaimed), `createdAt`, `updatedAt`. **Read with explicit columns only** — never `selectAll()` |
| `instance_secret` | `id integer primary key default 1 CHECK (id = 1)`, `authSecret text`, `setupCode text`, `createdAt`. **Read and written only by `lib/boot/`**, which exports `verifySetupCode(code)` and `clearSetupCode(trx)` for `/setup`. CI fails if any file outside `lib/boot/`, `db/migrations/` and the generated `db/schema.ts` names it. It is separate from `settings` because the settings read is public: today `queries/get-org.ts` is `selectAll()` behind a `publicProcedure`, and a mechanical rename would serve the auth secret to anonymous visitors |
| `user`, `auth_session`, `auth_account`, `auth_verification`, `auth_rate_limit` | Better Auth's DDL, generated for the pinned version and pasted verbatim, followed by the `role`/`scope` defaults and `CHECK`s (§3). Better Auth's migrator never runs at runtime |
| `feedback` | `id uuid pk default gen_random_uuid()`, `authorId text references "user"(id) on delete set null` (nullable: anonymous posts), `title text not null`, `description text not null` (sanitised HTML), **`plainText text not null`**, `category feedback_category`, `status feedback_status`, `upvotes numeric not null default 0`, `embedding <vector type>`, `embeddingSkipped boolean not null default false` (§5), `createdAt`, `updatedAt timestamptz(3) not null default now()` (set by every edit; §5 compares it). **No `orgId`** |
| `comment` | `id`, `postId uuid not null references feedback(id) on delete cascade`, `parentCommentId uuid references comment(id) on delete cascade`, `authorId text references "user"(id) on delete set null` (**now nullable**; rendering shows a deleted author), `content text not null`, **`plainText text not null`**, `upvotes`, `embedding <vector type>`, `embeddingSkipped boolean not null default false`, `createdAt`, `updatedAt timestamptz(3) not null default now()` (as `feedback`'s) |
| `images` | `id uuid pk default gen_random_uuid()`, `bytes bytea not null`, `contentType text not null CHECK ("contentType" IN ('image/png','image/jpeg','image/gif','image/webp'))`, `byteSize integer not null`, `width integer not null`, `height integer not null`, `createdAt timestamptz not null default now()` |
| `image_ref` | `imageId uuid not null references images(id) on delete cascade`, `postId uuid references feedback(id) on delete cascade`, `commentId uuid references comment(id) on delete cascade`, `CHECK (num_nonnulls("postId", "commentId") = 1)`; unique per (image, owner) as two partial unique indexes, `("postId", "imageId") WHERE "postId" IS NOT NULL` and `("commentId", "imageId") WHERE "commentId" IS NOT NULL` — a plain `UNIQUE` over the three columns enforces nothing, because one owner is always null, and `NULLS NOT DISTINCT` needs Postgres 15 *(measured)* — plus `("imageId")` for the sweep; writers use `ON CONFLICT DO NOTHING` |
| `insights` | today's columns including those added by `2026-07-25-insights.sql` (with `firstSeenAt` as a column default, not a backfill), **no `orgId`** |
| `insight_reports` | **no `orgId`**; gains `status text not null CHECK (status IN ('running','succeeded','failed'))`, `startedAt timestamptz not null default now()`, `heartbeatAt timestamptz not null default now()` (so a run that dies before its first heartbeat still ages out — a null one never matched the stale-run predicate *(measured)*), `finishedAt timestamptz`, `error text` (§5 background runs) |
| `admin_invites` | **no `orgId`**; gains `expiresAt timestamptz not null default now() + interval '7 days'` |
| `moderation_event` | `id bigint generated always as identity primary key`, `createdAt timestamptz not null default now()`, `postId uuid references feedback(id) on delete cascade`, `commentId uuid references comment(id) on delete cascade`, `CHECK (num_nonnulls("postId", "commentId") = 1)`, `reason text not null CHECK (reason IN ('provider-auth','provider-credit','provider-rate','provider-error','daily-limit','key-unreadable','limiter-error'))` — one row per item stored unscreened (§5); Activity's **Unscreened** filter and the System panel's 24-hour count read it |
| `job_lease` | `name text primary key`, `holder text not null`, `until timestamptz not null` — which replica runs the embedding backfill |
| `ai_settings` | `id integer primary key default 1 CHECK (id = 1)`, `enabled boolean` (**nullable**: null = not chosen, true = on, false = turned off, which also overrides the environment), `apiKey text` (ciphertext, §5), `apiKeyLast4 text`, `apiKeySetAt timestamptz`, `creditWaitUntil timestamptz` (§5), `options jsonb not null default '{}'` (chat and embedding models, vision, timeout, daily limit, privacy switches; validated with Zod), `indexFingerprint jsonb` (`{ model, dimensions, generation }`, §5), `keepOffAt timestamptz`, `keepOffBy text references "user"(id) on delete set null`, `lastCheck jsonb` (`{ at, last4, key: 'ok'\|'invalid'\|'management'\|'expired'\|'unknown', chat, search }` — mapped verdicts only; ignored when `last4` is not the current key's), `health jsonb` (per capability, `{ chat, embeddings }`, each `{ lastSuccessAt, lastFailureAt, failingSince, lastReason, failuresLastHour }`, mapped reasons only; only `provider-auth`, `provider-credit`, `provider-rate` and `provider-error` outcomes of real calls count — never input-caused 4xx, refusals, budget or limiter refusals, the live check or the credit wait; `failingSince` is set by the first counted failure after a success and cleared by the next success; written at most once a minute per process, and at once when it turns failing or healthy; drives "needs attention"), `updatedAt timestamptz(3) not null default now()` (millisecond precision, so it survives the round trip through a JS `Date` and JSON — at the default microsecond precision no save ever matched, 0 of 5 *(measured)*; written only by admin actions; a save against a newer value is refused), `updatedBy text references "user"(id) on delete set null`. Read and written only through `lib/llm/settings-store.ts` (a CI rule, §5) |
| `llm_usage` | `day date not null` (the UTC date, from `(now() AT TIME ZONE 'UTC')::date` or computed in JS — never `current_date`, which follows the session time zone), `feature text not null CHECK (feature IN ('moderation','title','embed-write','embed-query','backfill','insights','ask-ai','rewrite','check','probe'))`, `calls`, `errors` and `uncostedCalls` `integer not null default 0`, `inputTokens` and `outputTokens` `bigint not null default 0` (read back as strings by `pg`; converted before adding), `costUsd numeric(20,12) not null default 0` (as OpenRouter reports it; a query embedding costs about $0.0000002; a response without a cost adds 0 and counts in `uncostedCalls`, which the page shows as "N calls without a reported cost"), primary key `(day, feature)`; each call is one `INSERT … ON CONFLICT DO UPDATE` adding to the row — the AI page's usage figures |
| `admin_notice` | `userId text not null references "user"(id) on delete cascade`, `notice text not null CHECK (notice IN ('ai-off-card','ai-unseen-notice','ai-broken-card'))`, `dismissedAt timestamptz not null default now()`, `hiddenUntil timestamptz` (null = until the condition recurs), primary key `(userId, notice)` — per-admin dismissals (§5, *Telling the admin*) |
| `user_upvote`, `activity_seen`, `rate_limit` | unchanged in shape. `user_upvote.contentId` and `activity_seen.itemId` have no FK by design (they point at either a post or a comment); the sweep removes orphans |

Enums: `feedback_category` and `feedback_status` are kept. The dead
`subscription_frequency` and `subscription_name`, and `user_org_role`
(superseded by the `role` text column), are not carried forward.

Indexes: `insights_org_archived_idx (orgId, isArchived)` and
`insight_reports_org_created_idx (orgId, createdAt DESC)` are **reduced** to
`(isArchived)` and `(createdAt DESC)`, not dropped (they back the insights
page's filter and ordering). The duplicates `user_id_key` (beside the primary
key) and `activity_seen_userid_itemid_unique` (beside its primary key) are not
reproduced. Every foreign-key column on a multi-row table gets an index — `feedback("authorId")` among them — plus `moderation_event("createdAt")` and the backfill's partial indexes `("id") WHERE embedding IS NULL AND NOT "embeddingSkipped"` on `feedback` and `comment`. Identifiers are camelCase; in raw `sql` fragments they are double-quoted (`num_nonnulls("postId", "commentId")` — unquoted, it fails with `42703` *(measured)*). The whole `0001`, written from this table, runs as 52 statements on Postgres 18.3 with pgvector 0.8.1 and, without the vector columns, on 13.2 and 17.5 *(measured, 2026-09-27)*.

Foreign keys: **authorship** (`feedback.authorId`, `comment.authorId`) is
`ON DELETE SET NULL`: cascading from `user` would reach other people's content
(user → their posts → every comment on those posts → whole reply threads), and
today `comment.authorId` has no `ON DELETE` action at all, which makes a user
row undeletable by any route, including a hand-run erasure. **Per-user state**
(`user_upvote.userId`, `activity_seen.userId`, both part of their primary keys)
and Better Auth's own tables keep `ON DELETE CASCADE`.

### pgvector: installed by the migration, always schema-qualified

Boot runs `CREATE EXTENSION IF NOT EXISTS vector` before any migration, on every boot, mapping failures to prerequisite messages rather than stack traces: SQLSTATE `0A000`/`58P01`
("pgvector is not available on this Postgres server — use an image or
provider that includes it") and `42501` ("the database user may not create
extensions — ask your provider or a superuser to run `CREATE EXTENSION vector`
once"). pgvector is not a trusted extension, so on self-managed Postgres that
statement needs a superuser; managed providers expose it through their own
mechanism.

It then reads the extension's schema and version from `pg_extension` (visible in the same transaction *(measured)*) and checks the version against what the configured dimension needs (HNSW needs 0.5.0; `halfvec` needs 0.7.0), failing with both numbers named. `0001` then builds the embedding columns, in TypeScript:

- `AI_EMBEDDING_DIMENSIONS` is validated as an integer in 1–4,000 (pgvector cannot build an HNSW index above 4,000, and a board without one could never be rebuilt or change model).
- The column type is `"<schema>".vector(<d>)` up to 2,000 and
  `"<schema>".halfvec(<d>)` above.
- HNSW indexes use `"<schema>".vector_cosine_ops` / `halfvec_cosine_ops` (pgvector refuses more than 4,000 dimensions, `column cannot have more than 4000 dimensions for hnsw index` *(measured)*, hence the ceiling above).

**Every runtime use of the operator is schema-qualified**: one helper,
`vectorDistance(column, vector)` in `db/vector.ts`, emits
`<column> OPERATOR("<schema>".<=>) <param>`, with the schema read from the
runtime state (below). It replaces `cosineDistance` at all six call sites
(`queries/get-feedback-posts.ts:73,91,106,112`, `get-activity-feed.ts:99,126`).
Measured with pgvector in an `extensions` schema and a `search_path` of
`"$user", public`: inserts work (the parameter is typed from the column), a
bare `<=>` fails with `operator does not exist: extensions.vector <=> unknown`,
and `OPERATOR("extensions".<=>)` works and uses the HNSW index.

This deletes the whole `search_path` apparatus of earlier revisions — the
session `SET`, the `ALTER ROLE … IN DATABASE … SET search_path` block, and
`PGVECTOR_SCHEMA`. That block did not survive a `pg_dump`/restore (role
settings are not in the dump and `0001` never re-runs), applied only to the
migrating role, took effect only on new connections (a pooler's existing
backends kept the old path), and aborted `0001` when the provider forbade the
`ALTER ROLE`. Nothing else in the app names a pgvector type.

**Paging through semantic search.** With an HNSW index a filtered query stops
after `hnsw.ef_search` candidates (40 by default), so "load more" on a
semantic search stopped at 40 results *(measured, 3,000 matching rows)*. The
search queries run **inside a transaction** (a `SET LOCAL` outside one is
silently ignored) that sets `SET LOCAL hnsw.iterative_scan = relaxed_order` on
pgvector ≥ 0.8.0 — which paged the full test window *(measured)*, up to
`hnsw.max_scan_tuples` (20,000) — and `SET LOCAL hnsw.ef_search = 400` on older versions (written as literal SQL text or `set_config('hnsw.ef_search', '400', true)`: `SET LOCAL` takes no bind parameter *(measured)*), which caps a semantic search at 400 results (documented). Approximate
search loses a few percent of recall at realistic dimensions, as any HNSW
search does.

### Boot runs inside the server process

**`instrumentation.ts`** (new) is the entry point. Next calls `register()`
once per server instance and **holds every request until it finishes**
(`next/dist/server/next-server.js:572-578`; route modules await it too,
`server/route-modules/route-module.js:367-373`). The standalone server prints
"Ready" and binds the port *before* `register()` runs; requests arriving
during boot (including the database wait) are held, not refused *(measured)*.
Next does not call `register()` during `next build` (it returns early when
`NEXT_PHASE === 'phase-production-build'`); the guard below is
belt-and-braces.

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    await import("./lib/boot/register").then((m) => m.register());
  }
}

// lib/boot/register.ts (Node-only; keeps process.exit out of the file Next also compiles for the edge runtime)
export async function register() {
  try {
    const { boot } = await import("./index");
    await boot();
  } catch (error) {
    console.error("Feedbackland could not start:", error);
    process.exit(1);
  }
}
```

The `try` is load-bearing: when `register()` rejects, Next logs "An error
occurred while loading instrumentation hook" and **keeps running, answering
500 to every request** — and Docker does not restart unhealthy containers
*(measured)*. `process.exit(1)` inside `register()` ends the process with code
1 *(measured)*.

This one choice is what makes the plan executable. An earlier design ran boot
from a separate `docker-entrypoint.mjs` plus `scripts/*.mjs` in the runner
image, and none of it could run: Next bundles `kysely`, `better-auth` and
`pgvector` into its server chunks, so `.next/standalone/node_modules` contains
only `pg` and Next's own runtime packages and every import failed with
`ERR_MODULE_NOT_FOUND` *(measured)*; a `.mjs` cannot import the app's
TypeScript, its `@/` aliases or its auth options; guarded modules throw under
plain Node because `server-only` resolves to its throwing default outside the
`react-server` condition *(measured)*; and processes started with
`docker compose exec` never see variables an entrypoint exported into the
server. Inside the bundle all four problems disappear. Verified with the
default bundler — `next build` in Next 16 is Turbopack — including a
`server-only` import in the boot graph, and `next dev` runs the same
`register()` at startup *(measured)*.

**Three copies of every module.** Next compiles instrumentation, route
handlers and server-component pages as separate bundle layers, and each
process holds **one instance of every module per layer**: a module-level pool
was created three times, and a value boot stored in module scope was invisible
to a route handler *(measured)*. Only `process.env` and `globalThis` are
shared. Therefore:

- `db/db.ts` memoises the pool and the Kysely instance on
  `globalThis.__feedbackland` (`pool ??= new Pool(…)`), so a process opens at
  most `DATABASE_POOL_MAX` connections, not three times that.
- **`lib/runtime-state.ts`** holds everything boot, housekeeping or the probe
  writes and request handlers read — the pgvector schema and version, the
  embeddings state (verified, unverified, disabled and why), the cached AI
  configuration (§5, 5-second lifetime), the setup-complete latch, the banner
  facts — on `globalThis[Symbol.for("feedbackland.runtime")]`.
  The embedding column's width and the query-vector cache (§5) live here too. Durable facts (unscreened items, AI health, insight runs) live in the database.
- The auth secret reaches Better Auth through `lib/config.ts`, which keeps its
  resolved values on `globalThis.__feedbackland`, beside the pool.

`lib/boot/index.ts` (server-only), in order:

1. **Resolve configuration** (`lib/config.ts`): every variable in the
   Environment reference, with the empty string treated as unset, validated,
   and Better Auth's own variables deleted (§3). Invalid values fail with the
   variable named. `DATABASE_URL` unset fails with `DATABASE_URL is not set`.
2. **Wait for the database**: connect with retries every 2 s under an absolute 90 s deadline (each attempt's timeout is `min(5 s, remaining)`),
   logging `Waiting for database at <host>:<port>…`, then fail. `depends_on` is
   honoured only by `docker compose up`, not by a daemon restart after a host
   reboot, and Render, Railway and Kubernetes have no ordering at all.
3. **One transaction, on one connection**, opened on `new Kysely({ dialect: new BootDialect({ pool }) })` (below) so that the Migrator inside it uses the non-locking adapter — which is what makes boot safe
   across replicas and through a transaction pooler:
   1. `SET LOCAL lock_timeout = '15min'; SET LOCAL statement_timeout = 0` (a role- or database-level `statement_timeout` would otherwise end the lock wait or a long migration regardless, *(measured)*); `SELECT pg_try_advisory_xact_lock(4702111234474983745)`; when that fails, log "Waiting for another instance to finish migrating…" at once and block in `pg_advisory_xact_lock(4702111234474983745)`, logging every 30 s. Once the lock is held, `SET LOCAL lock_timeout = '30s'`, so a migration's DDL lock that cannot be had — an old replica's open transaction during a rolling upgrade — fails the boot (the restart retries) instead of stalling every board read queued behind it *(measured)*. The three lock keys (…745 boot, …746 sweeps, …747 setup) are written inline in the SQL or as BigInt (`4702111234474983745n`): as JS numbers all three round to `4702111234474983000` *(measured)*. No migration may use `CREATE INDEX CONCURRENTLY`, which cannot run inside a transaction.
   2. `CREATE EXTENSION IF NOT EXISTS vector` with the SQLSTATE mapping (above), then read the extension's schema and version from `pg_extension`, check the version against the configured dimension, and record both in the runtime state — on every boot, before comparing migrations. `0001` itself contains no `CREATE EXTENSION`.
   3. **Compare** applied migrations with the registry: `select to_regclass(current_schema() || '.kysely_migration') is not null` (and the Migrator gets `migrationTableSchema` set to the same schema: Kysely finds its table in any schema, so another app's `kysely_migration` elsewhere made boot fail *(measured)*), then the applied names. If
      the database has migrations this image does not know, it is *newer than
      the image*: log "database is newer than this image (<names>); starting
      without migrating" and skip — Kysely's own check (`previously executed
      migration X is missing`) would otherwise kill every older replica during
      a rolling upgrade and every rollback *(measured)*.
   4. Otherwise migrate: the boot transaction is opened from `new Kysely({ dialect: new BootDialect({ pool }) })`, and its `trx` is passed to `new Migrator({ db: trx, provider })` (Kysely 0.29 runs a `Migrator` given a `Transaction` inside it, `migrator.js:433-440`), with a **non-locking adapter**:
      ```ts
      class BootAdapter extends PostgresAdapter { async acquireMigrationLock() {} async releaseMigrationLock() {} }
      class BootDialect extends PostgresDialect { createAdapter() { return new BootAdapter(); } }
      ```
      Kysely's own adapter takes a **session-level** `pg_advisory_lock` and sets
      `lock_timeout` to one hour inside the caller's transaction; when a
      migration fails, its unlock runs in the aborted transaction and throws
      `25P02`, which **replaces the migration's real error**, and the session
      lock survives the rollback — through a transaction pooler, on a backend
      the next boot may never see *(measured)*. Boot already holds the
      transaction-scoped lock, so Kysely's is redundant. Then check the result's
      `.error` (`migrateToLatest` never throws): with the non-locking adapter a failure reports the migration's own error (e.g. `42P01`) and the names of the migrations in the batch *(measured)*. Kysely still reports the earlier entries of a failed batch as `Success` although the whole transaction rolled back, so the log names only the failing migration and its error.
   5. **Seed**: `INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING`
      — but only on a database with no users; `INSERT INTO instance_secret (id) VALUES (1) ON CONFLICT DO NOTHING` runs on every boot (a lost secret row only signs everyone out once, and makes a stored OpenRouter key unreadable until an admin connects again), as does the same insert for `ai_settings` through `ensureAiSettingsRow(trx)` (a lost row only turns AI off; the store also treats a missing row as defaults). A missing `settings` row on a database that has users is treated
      as corruption (boot fails, naming the fix: restore), never as
      "unclaimed", so an accidental delete cannot reopen `/setup`.
   6. **Auth secret**: an injected `BETTER_AUTH_SECRET` always wins and is
      never persisted (Render's `generateValue` and an operator's own value
      both land here). Otherwise the stored one, else a generated 32-byte
      base64url value, stored.
   7. **Setup code** (§7): while `setupCompletedAt` is null, an injected
      `SETUP_CODE` (normalised, at least 12 characters, else boot fails naming
      the rule) overwrites the stored one on every boot; else the stored one;
      else a generated one. Once claimed, the stored code is cleared and
      `SETUP_CODE` is ignored.
   8. Mark `insight_reports` rows that are `running` with `"heartbeatAt" < clock_timestamp() - interval '5 minutes'` as `failed` (`now()` is the transaction's start, stale by any lock wait) — not every `running` row, because during a
      rolling deploy another replica may be executing one.

   Any failure rolls the whole transaction back — migrations, seed and all.
4. Record the auth secret in `lib/config.ts` before anything constructs Better
   Auth; `getAuth()` reads it lazily on first use. The boot Kysely instance
   shares the pool and is never destroyed (destroying it ends the pool for the
   whole app *(measured)*).
5. When OIDC is configured, construct `getAuth()` now, which runs discovery,
   so the banner can state its result.
6. Print the **startup banner** (§8).
7. Start the housekeeping loop and the background embedding probe (§5), both
   `unref()`'d and not awaited; a probe that ends in a mismatch or a failure
   logs one further `AI:` line naming both numbers or the reason.

Under `restart: unless-stopped`, a failed boot is a restart loop: the
`Feedbackland could not start` line repeats on every attempt and the
healthcheck stays unhealthy. The documented recovery for a failed migration is
"restore the backup, then report it". `register()` is guarded against double
execution (`globalThis`) for `next dev`'s reloads; in `next dev` the same
sequence runs against the developer's database, so there is no separate
migrate step anywhere.

### Connections: `db/db.ts`

`db/db.ts` is fifteen lines today (`new Pool({ connectionString })`). It gains:

- the `globalThis` memoisation above;
- `pool.on("error", …)`, logging the host and SQLSTATE only: pg-pool re-emits an idle client's error (e.g. `57P01` when Postgres restarts) on the pool, and with no listener Node exits the process (`pg-pool/index.js:51-63`; Kysely attaches none);
- `max` from `DATABASE_POOL_MAX` (default 10), `connectionTimeoutMillis`
  10,000, `idleTimeoutMillis` 30,000, `keepAlive: true`;
- **explicit TLS.** `pg` 8.23 / `pg-connection-string` 2.14 treat
  `sslmode=require` as **`verify-full`**, print a SECURITY WARNING on every
  start, and let the URL's SSL parameters override an explicit `ssl` object
  *(measured)*. Managed providers' dashboards hand out `sslmode=require`
  meaning libpq's "encrypt, don't verify", and providers whose CA is not in
  Node's store then fail. So `db/db.ts` removes `ssl`, `sslmode`,
  `sslrootcert`, `sslcert`, `sslkey`, `sslpassword` and `uselibpqcompat` from
  the URL (any of them would override the object; `?ssl=true` alone forces
  verification *(measured)*) and builds `ssl` itself:

  | `sslmode` | TLS |
  |---|---|
  | absent, `disable`, `allow` | none — node-pg cannot fall back from TLS to plaintext, so libpq's default `prefer` is not reproducible; the bundled database has no TLS |
  | `prefer`, `require` | encrypted, unverified (`prefer` behaves as `require`: no plaintext fallback) |
  | `verify-ca` | chain verified against `DATABASE_SSL_CA`, which is then required; hostname not checked (`checkServerIdentity: () => undefined`) |
  | `verify-full` | verified against `DATABASE_SSL_CA` when set, else Node's store; for an IP host, `checkServerIdentity` is set explicitly, because `pg` omits the TLS `servername` for IP hosts and Node would otherwise check the name `localhost` instead of the address *(measured)* |

  Tested against plain, self-signed, Neon-style `channel_binding=require` and
  private-CA servers with no warning *(measured)*.

`DIRECT_DATABASE_URL` from earlier revisions is gone: boot's only lock is
transaction-scoped inside one transaction, which is valid through a
transaction pooler, so Neon's, Supabase's or any PgBouncer's pooled URL works
as `DATABASE_URL`. Verification 8 boots through PgBouncer in transaction mode
to prove it.

### Housekeeping

`lib/housekeeping.ts`, started by boot (phase 1 ships the sweeps; phase 6 adds
the backfill and probe retry):

- **A 5-second loop in every process.** Each tick first runs that process's embedding-probe retry when its backoff allows (§5). Then — only when embeddings are verified and the index fingerprint matches (or none is recorded yet), and on every tick while rows that are null and not `embeddingSkipped` remain (else every twelfth tick) — it runs **the embedding backfill** (up to 64 inputs per embedding request, `embedMany`, backing off on provider errors), only on the replica holding the
  `job_lease` row `embedding-backfill` (taken or renewed for 90 s with one
  `INSERT … ON CONFLICT DO UPDATE … WHERE until < now() OR holder = <me>`), so
  replicas do not duplicate model calls. The model calls happen **outside** any transaction. Also every 60 s: while `creditWaitUntil > now()`, `enabled IS NULL` and a readable key is stored, re-run the live check every fifth tick (every 5 minutes) on the same lease holder, turning AI on when it passes; while `failing(c)`, re-check every fifth tick on the same lease holder (`GET /api/v1/key`, then one call for `c`), a success clearing it; and fail `running` insight runs whose `heartbeatAt` is more than five minutes old.
- **Every 60 min**, the first one minute after boot: the sweeps below, one after another. Each batch of 1,000 runs in its own transaction that begins with `pg_try_advisory_xact_lock(4702111234474983746)` and skips when another replica holds it; each catches and
  logs its own errors. The sweep is not on the rate limiter's code path
  (`checkRateLimit` fails open and swallows errors, so a sweep inside it could
  break invisibly), and it runs whether or not anyone posts.

| Table | Deletes |
|---|---|
| `rate_limit` | `"windowStart" < now() - CASE WHEN key LIKE 'ai:instance:day:%' THEN interval '2 days' ELSE interval '1 hour' END` (the longest ordinary window is 15 min; a day row's `windowStart` is its first call of that UTC day, so it goes more than 24 h after the day ends — parsing the date out of the key would fail the whole sweep on one malformed key *(measured)*) |
| `auth_session`, `auth_verification` | `expiresAt < now()` |
| `auth_rate_limit` | `lastRequest` older than one hour (epoch **milliseconds**; Better Auth also prunes on window reset) |
| `admin_invites` | `expiresAt < now() - interval '1 day'` |
| `activity_seen` | **orphans only** — `itemId` matching neither a post nor a comment. It has no timestamp, and a missing row means "unseen", so an age-based sweep would re-mark every old item as new |
| `user_upvote` | orphans only, by the same rule |
| `insight_reports` | all but the newest 50 (only the latest is read) |
| `moderation_event` | older than 30 days |
| `llm_usage` | older than 400 days |
| `images` | `id IN (SELECT i.id FROM images i WHERE NOT EXISTS (SELECT 1 FROM image_ref r WHERE r."imageId" = i.id) AND NOT EXISTS (SELECT 1 FROM settings s WHERE s."logoImageId" = i.id) AND i."createdAt" < now() - interval '24 hours' LIMIT 1000 FOR UPDATE SKIP LOCKED)` (§4). `NOT IN`/`<>` against a null `logoImageId` match nothing, and without `SKIP LOCKED` a post attaching a day-old image lost it to the sweep *(measured)* |

### Generated types

`db/schema.ts` is generated by `npm run db:codegen` (kysely-codegen against
`DATABASE_URL`) and committed, so `tsc` and the Docker build need no database.
It is type-only and exempt from the `server-only` rule; client code may import
it only with `import type` (today `hooks/use-auth.tsx:22` imports it as a
value, which becomes `import type`). Regenerated against stock Postgres, the
seven Supabase schemas it carries today (`auth`, `storage`, `realtime`,
`extensions`, `pgsodium`, `vault`, `supabase_migrations`) vanish. Both
`vector` and `halfvec` columns generate as `string | null`, so the file does
not depend on the configured dimension. CI regenerates it against its own
freshly booted database and fails on `git diff --exit-code db/schema.ts`.

The order inside phase 1 is fixed: **`docker compose -f compose.dev.yml up -d` (an empty database) → `npm run db:auth-ddl` (`tsx --env-file=.env.local scripts/print-auth-ddl.ts`) → write `0001`, pasting its output → `npm run dev` (boot migrates) → `npm run db:codegen` → commit → the code changes typecheck.**

### Upgrades and rollbacks

- Migrations are forward-only; there are no down migrations.
- From `v1.0.0-rc.1`, every migration is **backward-compatible with the
  previous release** (additive first; destructive one release later), because
  during a rolling upgrade the new process migrates while the old one still
  serves, and boot lets an older image start against a newer database (above).
- Rolling back across an incompatible change means restoring a backup; the
  release notes say when a release contains one.

## §7 — First run and recovery

### `/setup`

From phase 3, while `settings.setupCompletedAt` is null, every board and admin
route redirects to `/setup` (the board layout reads settings server-side
through `lib/settings.ts`, §10, before anything renders), and `/api/auth/*`
refuses HTTP requests except `/get-session` (§3). Writes are closed too: `/api/trpc` mutations, `POST /api/images` (from phase 5), `POST /api/feedback/create` (with its CORS headers) and `/api/chat` answer 403 `SETUP_REQUIRED`, so nobody can post, upload or spend an environment key's credit on an unclaimed board.

`/setup` is one form with **five fields**: setup code, board name, your name,
email, password. Its server action:

1. Calls `verifySetupCode(code)` from `lib/boot/` — the only module that reads
   `instance_secret` (§6) — which normalises the input (uppercase, dashes and
   whitespace removed) and compares it in constant time with the stored code.
   Rate limit `setup:ip`, 5 per 15 minutes, consumed before the code is compared, **failing closed**: if the limiter
   itself errors, the attempt is refused.
2. Opens a transaction on a **dedicated connection** (a one-connection `pg.Pool` built from the same resolved configuration — Kysely's `PostgresDialect` needs a pool — and destroyed afterwards; never a connection from the app pool), takes `pg_advisory_xact_lock(4702111234474983747)`, and re-checks `"setupCompletedAt" IS NULL`. Better Auth's queries in step 3 use the pool, so they never wait behind the connection holding the lock; with a pool connection, `DATABASE_POOL_MAX=1` made setup impossible and 2 failed under concurrency *(measured)*. No code path anywhere holds an **app-pool** connection in a transaction while calling `getAuth().api.*`. Two simultaneous submissions
   serialise; the second sees the instance claimed and is refused.
3. Creates the identity with `auth.api.signUpEmail({ body, headers })` — a
   server call, which the pre-setup hook lets through (§3) — with the
   password trimmed and checked against the 8–128 rule. It **never adopts an
   existing identity**: if the email already exists, setup fails.
4. Sets that user's `role = 'admin'` by the id it just created, sets
   `platformTitle` and `setupCompletedAt = now()`, calls
   `clearSetupCode(trx)` from `lib/boot/`, and commits. If anything fails after
   step 3, the user created in step 3 is deleted — on the app pool, after the `ROLLBACK` — before the error is returned,
   so a retry is not refused with "email already exists" (if the process dies between steps 3 and 4, that email stays taken and the operator uses another; before setup no other path can create a user).
5. The session cookie is set on the response by Better Auth's `nextCookies()`
   plugin (verified from a Next 16.3.5 server action: the cookie arrives on the
   303, and the next `getSession` reads `role: admin` fresh, since
   `cookieCache` is off *(measured)*). The session's scope is `first-party`.
   From phase 6b it redirects to `/admin/settings/ai?welcome=1` — the recommended next step, turning on AI, with **Skip for now** and **Keep AI off** (§5, *Telling the admin*); in phases 3–6a, to `/admin`.

Afterwards `/setup` redirects to `/`. A fresh board is **empty**: today's
`createOrgQuery` seeds three example posts, and `/setup` deliberately does not
— an operator's first act should not be deleting sample content. The
empty-state copy carries that weight.

### The setup code

An instance reachable on the internet before it is claimed would otherwise
grant admin to whoever loads `/setup` first, and new `*.onrender.com` hosts
appear in public certificate-transparency logs within minutes. So a setup code
is **always** required. (Making it conditional on a loopback client is not
implementable: `NextRequest` has no socket address in Next 16, and the only
signal is the spoofable `x-forwarded-for`.)

| Rule | |
|---|---|
| Generated | 12 characters of Crockford base32, shown as `XXXX-XXXX-XXXX` (60 bits) |
| Chosen (`SETUP_CODE`) | at least 12 characters after normalisation, else boot fails naming the rule. Empty means unset |
| Precedence | while unclaimed, an injected `SETUP_CODE` **wins and overwrites** the stored code on every boot — so "change `SETUP_CODE` in the dashboard and restart" works for someone who lost it. Once claimed, the stored code is cleared and `SETUP_CODE` is ignored |
| Display | a generated code is printed in the startup banner. A **chosen** code is never logged; the banner says "Setup code: the value you set in SETUP_CODE" |
| Brute force | per-IP limit (best-effort without a trusted proxy, §3) plus the code's strength. There is **no instance-wide ceiling**: it would let anyone lock the real operator out of first-run setup indefinitely, and 60 bits (or 12 chosen characters) is out of brute-force reach even without per-IP limits |

Where the operator finds it:

| Install | How |
|---|---|
| `docker compose up` (foreground) | the banner, in the terminal they are watching |
| detached / `docker run -d` | `docker compose logs app` or `docker logs feedbackland`, look for `Setup code` |
| Render | chosen in the deploy form (`sync: false` prompts during the initial blueprint creation; later changes are a dashboard edit plus restart) |
| Railway | chosen in the template's variable form |
| App stores | the store's generated secret, per store (§8) |

Binding the published port to `127.0.0.1` instead was considered and rejected:
it breaks the "bring it up on a VPS and visit `http://ip:3000`" flow, trading
a visible one-line step for an invisible connection failure.

### `/recover` — admin recovery without a terminal

The last-resort path when every admin is locked out and there is no SMTP. It
replaces an earlier `docker compose exec app node scripts/reset-password.mjs`,
which could not work (Render's free tier has no shell; the script could not
see a secret generated at boot; it could not import the auth configuration)
and still would have needed a terminal.

- The operator sets **`RECOVERY_CODE`** (at least 20 characters; compared in constant time and never logged) wherever they set environment variables, and restarts. There is no instance-wide ceiling, for the reason given for the setup code (§7): it would let anyone keep the last-resort path closed; 20 characters are out of brute-force reach. The banner warns, on every boot,
  that recovery is enabled.
- `/recover` (first-party, framing denied, noindex) checks the code before reading anything else; it takes the code, an
  **admin's** email and a new password (trimmed, 8–128). It is rate-limited
  (`recover:ip`, 5 per 15 minutes) and fails closed. It resets that admin's
  password through `requestPasswordReset` with the token captured (§3) and
  `resetPassword`, which also revokes that admin's other sessions.
- `/recover` answers 404 whenever `RECOVERY_CODE` is unset.
- The docs tell the operator to remove the variable afterwards.

## §8 — Packaging and hosting

This section carries the product's ease-of-use goal, so every mechanism below
was checked against the vendor's current documentation (2026-09-26) and every
number a reader might act on is a real number.

| Way in | Who | What they do | Terminal? |
|---|---|---|---|
| **One-click** (Render, Railway) | anyone | click, sign in, choose a setup code, wait | **No** |
| **Docker Compose** | comfortable in a terminal | download one file, run one command | yes, once |
| **`docker run`** against an existing Postgres | has a database already | one command | yes, once |
| **App stores / control planes** (phase 10) | homelab and VPS-PaaS users | install from the store | no |

After install, only a Compose or `docker run` upgrade needs a terminal (one command): backfill is automatic, rebuild is a button, recovery is an environment variable, and upgrades on Render and Railway are one platform action (below).

### `compose.yml`

One canonical file at the repository root. The README and `SELFHOSTING.md`
download it; neither carries a copy. Requires **Docker Compose 2.24.4 or
later** (for `env_file.required` and, in the TLS overlay, `!reset`); Debian
12's packaged `docker-compose` 1.29 is too old, Docker's own packages are not.

```yaml
name: feedbackland

services:
  db:
    image: pgvector/pgvector:pg18
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-feedbackland}   # the port is not published; set your own if you publish 5432
      POSTGRES_DB: feedbackland
    volumes:
      # NOT /var/lib/postgresql/data: Postgres 18 moved PGDATA to
      # /var/lib/postgresql/18/docker and declares the VOLUME one level up.
      - db:/var/lib/postgresql
    healthcheck:
      # -h forces TCP; without it this passes during the image's first-time
      # setup, whose temporary server listens on the socket only.
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres -d feedbackland"]
      interval: 5s
      timeout: 5s
      retries: 20

  app:
    image: ${FEEDBACKLAND_IMAGE:-ghcr.io/feedbackland/feedbackland:1}
    restart: unless-stopped
    depends_on: { db: { condition: service_healthy } }
    environment:
      DATABASE_URL: ${DATABASE_URL:-postgres://postgres:${POSTGRES_PASSWORD:-feedbackland}@db:5432/feedbackland}
      APP_URL: ${APP_URL:-}
      SETUP_CODE: ${SETUP_CODE:-}
      CLIENT_IP_HEADER: ${CLIENT_IP_HEADER:-x-forwarded-for}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
      SMTP_URL: ${SMTP_URL:-}
      SMTP_FROM: ${SMTP_FROM:-}
      RECOVERY_CODE: ${RECOVERY_CODE:-}
    env_file:
      - path: .env
        required: false
    ports: ["${FEEDBACKLAND_PORT:-3000}:3000"]
    healthcheck:
      # No external binary: node:*-slim purges curl and wget.
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 60s
    read_only: true
    tmpfs: ["/tmp:size=64m", "/app/.next/cache:size=64m"]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]

  backup:
    profiles: [backup]
    image: pgvector/pgvector:pg18   # pg_dump must be at least the server's major version
    restart: unless-stopped
    init: true                      # sh as PID 1 ignores SIGTERM otherwise
    depends_on: { db: { condition: service_healthy } }
    environment:
      PGPASSWORD: ${POSTGRES_PASSWORD:-feedbackland}
      BACKUP_INTERVAL_HOURS: ${BACKUP_INTERVAL_HOURS:-24}
      BACKUP_KEEP: ${BACKUP_KEEP:-14}
    volumes: ["./backups:/backups"]
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        umask 077
        [ "$${BACKUP_KEEP}" -ge 1 ] || { echo "BACKUP_KEEP must be at least 1" >&2; exit 1; }
        while true; do
          f=/backups/feedbackland-$$(date +%Y%m%d-%H%M%S).dump
          if pg_dump -h db -U postgres -d feedbackland -Fc -Z 6 -f "$$f.partial"; then
            mv "$$f.partial" "$$f" && echo "backup: $$f"
          else
            rm -f "$$f.partial"; echo "backup FAILED" >&2
          fi
          ls -1t /backups/feedbackland-*.dump | tail -n +$$((BACKUP_KEEP+1)) | xargs -r rm --
          sleep $$((BACKUP_INTERVAL_HOURS*3600))
        done

volumes:
  db:
```

What is a decision, not boilerplate:

- **`name: feedbackland`.** Without it the volume is named after the folder,
  and moving the file makes the board "disappear" onto a fresh empty volume.
- **Overridable defaults, `""` meaning unset.** `environment:` beats
  `env_file:`, so a hard-coded `DATABASE_URL` would silently ignore the one in
  `.env` *(measured)*. Every value is `${VAR:-default}`, which also lets
  Coolify, Dokploy and CasaOS show the operator-facing settings in their UIs;
  `env_file` passes everything else from `.env`.
- **`PORT` is not an operator setting here.** The container always listens on
  3000; change the host side with `FEEDBACKLAND_PORT`. Setting `PORT` in `.env`
  would move the server while the mapping stayed at 3000.
- **Healthcheck timings** are explicit: Docker's 30-second default adds dead
  air to every cold start. `start_period` covers the first boot's migration.
- **Hardening is in the artefact**, not only in prose: read-only root, sized
  `tmpfs` for the two paths Next may write (Next's ISR flush is disabled,
  `experimental.isrFlushToDisk: false`; across pages, 404s, RSC requests, route
  handlers and metadata the standalone server wrote no files *(measured)*),
  dropped capabilities, `no-new-privileges`. Verification 10 exercises every
  route type under it.
- **The database port is not published.** The default password is private to
  the compose network; `POSTGRES_PASSWORD` in `.env` changes it everywhere it is
  used (set it before the first `up`: Postgres only reads it at initialisation).
- **Backups are an opt-in profile in the same file** (added in phase 7):
  `docker compose --profile backup up -d`. It dumps the bundled database only.
  A dump is written to `*.partial` and renamed only on success, so a failing
  `pg_dump` (which creates its output file before connecting) never rotates a
  good backup out *(measured)*. Dumps are root-owned and written `umask 077`
  because **a backup is a credential dump** — it contains the stored auth
  secret (when generated), password hashes, session rows and reset tokens
  (§8, *Backups*).
- **The image is pinned to a major tag** (`:1`), so `docker compose pull`
  cannot cross a major. `FEEDBACKLAND_IMAGE` exists for testing release
  candidates.

**Adding a domain and HTTPS** is one more file:

```yaml
# compose.tls.yml — docker compose -f compose.yml -f compose.tls.yml up -d
services:
  app:
    ports: !reset []            # otherwise port 3000 stays published beside Caddy
    environment:
      APP_URL: https://${DOMAIN:?set DOMAIN to your hostname}
      CLIENT_IP_HEADER: x-forwarded-for
  caddy:
    image: caddy:2
    restart: unless-stopped
    command: caddy reverse-proxy --from ${DOMAIN} --to app:3000
    ports: ["80:80", "443:443", "443:443/udp"]
    volumes: ["caddy_data:/data"]
    depends_on: [app]
volumes:
  caddy_data:
```

The TLS instructions also have the operator add `COMPOSE_FILE=compose.yml:compose.tls.yml` and `DOMAIN=…` to `.env` (on Windows, with `COMPOSE_PATH_SEPARATOR=;` and `;`),
so every later `docker compose` command — including the upgrade — includes
the overlay; without it, `docker compose pull && up -d` would re-publish 3000
and drop `APP_URL` *(measured)*.

Compose **appends** `ports` from an override file; without `!reset` the
overlay leaves `3000` published (and Docker's published ports bypass UFW), so
anyone could reach the app directly, bypassing TLS, and forge
`X-Forwarded-For` past every per-IP limit *(measured: the naive overlay still
publishes 3000; `!reset` publishes none)*. Caddy's `reverse-proxy` command
obtains and renews certificates, sets `X-Forwarded-For/-Proto/-Host` (replacing
any client-supplied values, so a single-value `X-Forwarded-For` reaches the
app), flushes streamed responses (Ask-AI) immediately, and applies no read
timeout. `DOMAIN` is a variable of this overlay only; the app itself reads
`APP_URL`. Any other reverse proxy works if it forwards those headers, does not
buffer streams, and allows long reads; `SELFHOSTING.md` gives an nginx
example.

**`compose.dev.yml`** (contributors): the same `db` service with `5432`
published on `127.0.0.1`, for `npm run dev`.

**An existing Postgres**, without the bundled database:

```bash
docker run -d --name feedbackland --restart unless-stopped -p 3000:3000 \
  -e DATABASE_URL='postgres://user:pass@host:5432/db?sslmode=verify-full' \
  -e APP_URL='https://feedback.example.com' \
  ghcr.io/feedbackland/feedbackland:1
docker logs feedbackland 2>&1 | grep "Setup code"
```

(`compose.external-db.yml`, the app service alone — `DATABASE_URL: ${DATABASE_URL:?set DATABASE_URL to your Postgres URL}` and no `depends_on` — does the same for Compose users; a copied app service would keep the default `@db:5432`, wait 90 s and exit.) `sslmode` follows libpq semantics (§6): `verify-full` for providers
with public CAs, `require` for encryption without verification, and
`DATABASE_SSL_CA` for a private CA.

**An all-in-one image** (Postgres inside the app image) was rejected: Postgres
major upgrades inside an application image are painful, and the failure mode is
an operator who cannot upgrade without risking their only copy of the data.

### The image

`Dockerfile`, multi-stage, published to GHCR by CI (§ Release process):

- **Base:** `node:24-trixie-slim` (Debian 12 "bookworm" passed to its LTS team on 2026-07-12), pinned by the **multi-arch index** digest — a platform-specific digest breaks the native arm64 build — in both stages;
  `engines.node: ">=24 <25"` in `package.json`.
- **Build stage:** `WORKDIR /app`; copy `package.json`, `package-lock.json`,
  **`.npmrc`** (`legacy-peer-deps=true`; without it the install resolves
  differently from every developer's) and `feedbackland-react/package.json`;
  `npm ci` — **with** optional dependencies (the Linux builds of `@next/swc`,
  the Tailwind engine, `lightningcss` and `rolldown` are optional; the
  Windows-generated lockfile already contains the linux-x64 and linux-arm64
  variants, checked with `npm ci --dry-run --os=linux --cpu=arm64`); copy the
  source; `RUN mkdir -p public` (phase 2 deletes the only tracked files there, and
  git keeps no empty directory); `ENV NEXT_TELEMETRY_DISABLED=1`; `RUN --network=none npm run build` (no network after `npm ci`, so no build step can fetch fonts or report anything; it builds the widget workspace, then runs `next build` — `components/app/widget-docs` imports
  `feedbackland-react`, whose `dist/` is gitignored); then delete
  `.next/standalone/node_modules/sharp` and `…/@img` and fail if either
  remains.
- **Runner stage:** `WORKDIR /app`; copy `.next/standalone`, `.next/static`, `public` and `LICENSE`, owned by root (nothing writes there; the `tmpfs` paths are the only writable ones); `USER node` (1000:1000);
  `ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
  HOSTNAME=0.0.0.0 KEEP_ALIVE_TIMEOUT=65000`; `EXPOSE 3000`;
  `CMD ["node", "server.js"]`. No entrypoint script, no scripts directory, no
  `npm` at runtime (npm writes logs, which fails on a read-only filesystem).
- **`HOSTNAME`.** The generated `server.js` binds
  `process.env.HOSTNAME || '0.0.0.0'` (`next/dist/build/utils.js:1125`). Docker
  sets `HOSTNAME=<container id>` first and then overlays the image's `ENV`
  (`daemon/container/container.go:802-831`), and containerd's CRI does the same
  (`internal/cri/server/container_create.go:730-738`), so the image's
  `HOSTNAME=0.0.0.0` wins on Docker, Compose and Kubernetes. Render and Railway
  do not inject `HOSTNAME`. Only an explicit `-e HOSTNAME=…` or a Kubernetes
  `env:` entry overrides it, and then the operator meant it. (Earlier revisions
  claimed platform-injected values always win, then claimed an entrypoint had
  to fix it; both were wrong.)
- **`PORT`** is 3000 by default; a platform-injected `PORT` (Render uses
  10000, Railway injects one) wins, which is what makes those platforms work
  unmodified. **`KEEP_ALIVE_TIMEOUT=65000`** keeps Node's keep-alive above
  Railway's 60-second edge idle timeout, which otherwise produces intermittent
  502s.
- **Multi-architecture:** `linux/amd64` and `linux/arm64`, built on **native**
  runners (GitHub's free arm64 runners for public repositories, GA
  2025-08-07), pushed by digest and merged into one manifest. Render requires
  amd64. 32-bit ARM is impossible: `pgvector/pgvector` publishes neither
  `arm/v7` nor `arm/v6`.
- **`.dockerignore` is an allow-list**: `*` excluded, then the build inputs
  re-included — `app/ components/ db/ feedbackland-react/ hooks/ lib/
  providers/ public/ queries/ trpc/`, `next.config.ts`, `tsconfig.json`,
  `postcss.config.mjs`, `components.json`, `package.json`,
  `package-lock.json`, `.npmrc`, `instrumentation.ts`, `proxy.ts`, and, until
  phase 3 deletes it, `firebaseConfig.ts` (imported by `lib/firebase/client.ts`;
  the build fails without it *(measured)*) — with
  `**/node_modules`, `**/dist`, `**/.next`, `**/*.tsbuildinfo` and `**/.env*`
  excluded again. This is load-bearing: Next **copies `.env` and
  `.env.production` into `.next/standalone`**
  (`next/dist/build/index.js:328-331`), so a developer's `.env` in the build
  context would ship inside a public image. CI asserts the image contains no
  `.env*` file.
- **Telemetry:** `next build` reports to `telemetry.nextjs.org` unless
  disabled, so the build stage sets `NEXT_TELEMETRY_DISABLED=1` (any non-empty
  value disables it; it is read with `!!`). The standalone runtime has no
  telemetry path at all (`Telemetry` is constructed only `if (opts.dev)`); the
  runtime `ENV` is belt-and-braces.

**`GET /api/health`** answers `200 { status: "ok", version }` when the
database answers a `SELECT 1` within 2 s and `503 { status: "down", version }`
otherwise. It makes **no** outbound call: Render probes every few seconds and
restarts after 60 s of failures, so a model-reachability check here would burn
a free tier's daily quota and tie the board's liveness to a third party.
Subsystem detail (model, embeddings, SMTP, providers) lives in the admin System
panel, not in this unauthenticated body.

**The startup banner** prints, on every boot: version; the resolved app URL
and where it came from (`APP_URL`, `RENDER_EXTERNAL_URL`,
`RAILWAY_PUBLIC_DOMAIN`, or "inferred per request"); database host, pgvector
schema and version; migrations applied or skipped; AI chat and embedding status with model and dimensions (and, while AI is off, "turn it on in Settings → AI (`/admin/settings/ai`)" — the app URL may not be known before the first request); SMTP on/off; enabled sign-in
providers with their **callback URIs**; the client-IP header; warnings
(recovery enabled, app URL unset so email reset and social sign-in are off,
neutralised Better Auth variables); and, while unclaimed, the setup code.

### One-click deploy

#### Render (`render.yaml`, first button)

```yaml
services:
  - type: web
    name: feedbackland
    runtime: image
    image:
      url: ghcr.io/feedbackland/feedbackland:1
    plan: 0.5c-512mb        # Render's plan ID since August 2026; the legacy name "starter" is still accepted
    region: oregon
    healthCheckPath: /api/health
    autoDeployTrigger: "off"
    envVars:
      - key: DATABASE_URL
        fromDatabase: { name: feedbackland-db, property: connectionString }
      - key: BETTER_AUTH_SECRET
        generateValue: true
      - key: SETUP_CODE
        sync: false
      - key: CLIENT_IP_HEADER
        value: true-client-ip   # observed on Render's edge, not documented by Render
      - key: MAX_IMAGE_STORAGE_BYTES
        value: "600000000"      # keeps images well inside the 1 GB database
databases:
  - name: feedbackland-db
    plan: 0.1c-256mb        # legacy name "basic-256mb"
    diskSizeGB: 1
    ipAllowList: []         # private network only (omitted, Render allows any IP); add your IP in the dashboard to pg_dump from outside
    postgresMajorVersion: "18"
    region: oregon
```

Confirmed against Render's Blueprint reference: `runtime: image` takes an
`image:` **object** (`url`, optional `creds` — only private images need
credentials); `fromDatabase.property: connectionString` is the private-network
URL; `generateValue` creates a 256-bit value only if the variable does not
already exist; `sync: false` **prompts during the initial blueprint creation**
(and is ignored by later syncs); `healthCheckPath` must answer 2xx/3xx within
5 s. The button needs no fork (`render.com/deploy?repo=…`).

- **APP_URL comes from Render.** Blueprints support no interpolation, so
  `render.yaml` cannot state the public URL; Render injects
  `RENDER_EXTERNAL_URL` at runtime, and `getAppUrl()` uses it (§10).
- **Pinned blueprint.** Render re-applies `render.yaml` to every linked
  instance on each push to the linked branch and overwrites conflicting
  dashboard edits. The button therefore points at a dedicated, protected **branch** (Render's deploy button takes `/tree/<branch>`),
  `render.com/deploy?repo=https://github.com/feedbackland/feedbackland/tree/render-v1`,
  treated as a frozen public contract (release candidates are walked from a
  `render-rc` branch identical except for `image.url: …:1.0.0-rc.N`, since `:1`
  exists only from `v1.0.0`); the docs tell operators they may turn
  Auto Sync off. Image-backed services never redeploy on a registry push
  (`autoDeployTrigger` has no effect on them; the line is kept, quoted, for
  clarity), so upgrading is "Deploy latest reference" or the service's
  deploy-hook URL with `imgURL`.
- **Cost, stated first:** **$7** (web `0.5c-512mb`, formerly `starter`, 0.5 CPU / 512 MB) **+ $6** (Postgres `0.1c-256mb`, formerly `basic-256mb`) **+ $0.30/GB** of database storage — about **$13.30
  a month** at 1 GB. Without `diskSizeGB`, a Basic database is created with
  15 GB (≈ $4.20 more per month) and storage can never be shrunk.
- **The free tier, honestly:** the web service sleeps after 15 minutes idle
  and takes about a minute to wake — while it wakes, Render serves its own
  HTML page, so a widget's POST fails opaquely and the drawer's 15 s load
  timeout fires; free Postgres is a fixed 1 GB with **no backups of any kind**,
  becomes inaccessible at 30 days and is **deleted at 44**; there is no shell;
  and outbound SMTP ports are blocked. Verification 9 checks whether free
  plans can be selected from the blueprint form.
- **The blueprint keeps a live link to our repository.** "The operator is free
  to leave" stays true; "the operator is not entangled with us" is not, and the
  docs say so.

#### Railway (second button)

Railway templates are created in its dashboard and get a shareable URL without
marketplace publishing; the README button links
`railway.com/new/template/{code}` (the template's landing page is
`railway.com/deploy/{code}`). Because that
definition lives outside the repository, it is **specified in the repository**
(`deploy/railway/TEMPLATE.md`) and recreated from it:

| Service | Settings |
|---|---|
| `postgres` | image `pgvector/pgvector:pg18` (Railway's stock Postgres has no pgvector and Railway does not plan to add extensions); volume mounted at **`/var/lib/postgresql`**; `POSTGRES_PASSWORD=${{secret(32, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}}` (an explicit URL-safe alphabet, since the value is embedded in `DATABASE_URL`), `POSTGRES_DB=feedbackland` |
| `feedbackland` | image `ghcr.io/feedbackland/feedbackland:1`; public domain enabled; `DATABASE_URL=postgres://postgres:${{postgres.POSTGRES_PASSWORD}}@${{postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/feedbackland`; `APP_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}`; `SETUP_CODE` (required, user-filled); `BETTER_AUTH_SECRET=${{secret(64, "abcdef0123456789")}}` (injected, so a database dump alone cannot decrypt the stored OpenRouter key, §5); `CLIENT_IP_HEADER=x-real-ip`; healthcheck `/api/health` |

Release candidates are walked from an unpublished copy of the template pinned
to the rc tag; the published template points at `:1` from phase 9. Cost: the
Hobby plan, $5/month including $5 of usage. Railway can update an
image service automatically when a new tag is published, backing up volumes
first on Pro — the best upgrade story of any target, documented as such.

#### App stores and control planes (phase 10)

The compose file is the **source** each store's artefact is generated from,
not the artefact itself: every store has its own format and rules
(verified per store):

| Store | Artefact (in `deploy/<store>/`, generated by `scripts/gen-wrappers.ts`) | Notable rules | Setup code source |
|---|---|---|---|
| Umbrel (community store) | `umbrel-app-store.yml`, `<id>/umbrel-app.yml`, `<id>/docker-compose.yml` | required `app_proxy` service; no raw `ports:`; `${APP_DATA_DIR}` bind mounts; images pinned `tag@sha256`; `PROXY_AUTH_ADD: "false"` (a public board); no log-scraping first-run | `SETUP_CODE=${APP_PASSWORD}` with `deterministicPassword: true` |
| CasaOS / ZimaOS | `docker-compose.yml` with top-level `name` and `x-casaos` | must pass `docker compose config -q` | none offered: the generated code, read from the store's log view |
| Coolify | compose with `SERVICE_PASSWORD_POSTGRES` and `APP_URL: ${SERVICE_URL_APP_3000}` (Coolify's `SERVICE_FQDN_*` is the domain without the scheme) | no published ports; no floating tags. Catalogue submission needs 1,000 GitHub stars (the repo has 19); the file works as a custom compose resource now | `SETUP_CODE: ${SERVICE_PASSWORD_64_SETUP}` |
| Dokploy | compose + `template.toml` + `meta.json` | | `template.toml` `${password:24}` |
| Easypanel | `index.ts` + `meta.yaml` (PR to `easypanel-io/templates`) | exact versions; no hard-coded secrets | the template's random-password helper |
| Zeabur | template YAML | | its generated `PASSWORD` |
| CapRover | one-click app definition with a Postgres service | CapRover ignores healthchecks, `env_file`, `read_only`, `tmpfs` and `cap_drop` | `$$cap_gen_random_hex(24)` |

`scripts/gen-wrappers.ts` re-pins version and digest per release, and CI fails
if a committed wrapper differs from its regenerated form. **Umbrel, CasaOS,
Runtipi and TrueNAS are home-network systems** (`http://umbrel.local:PORT`);
a feedback board needs public HTTPS for customers to reach it and for the
widget to be framed, so the docs say those installs suit trying Feedbackland,
not running it publicly, unless the operator adds a tunnel. TrueNAS (Jinja2
templates), Runtipi and Unraid (no compose support) are not targeted.

**Deliberately not targeted:** **Vercel** — it builds and runs code as
Functions and cannot run this long-lived process or a prebuilt image, and a
Vercel button would recreate the split this plan removes. **Heroku** — it
cannot run images from an external registry. **Fly.io** — no deploy button,
and managed Postgres starts at $38/month. **DigitalOcean App Platform** — its
button creates only a *dev* database, and `CREATE EXTENSION vector` there is
unverified. **YunoHost** — its apps do not use Docker. **PikaPods** —
vendor-owned images only. **Swarm** — see Non-goals.

### Operating it

**Upgrading.**

| Install | Upgrade |
|---|---|
| Compose | `docker compose pull && docker compose up -d` (`pull` alone "does not start containers based on those images"); with TLS, `COMPOSE_FILE` in `.env` keeps the overlay. Portainer stacks read `stack.env`, not `.env` |
| `docker run` | `docker pull …:1`, then remove and re-run the container |
| Render | "Deploy latest reference", or the deploy hook with `imgURL` (a one-off: later deploys return to the service's configured tag) |
| Railway | automatic image updates, or redeploy |

Back up first. **Rolling back**: set `FEEDBACKLAND_IMAGE=ghcr.io/feedbackland/feedbackland:<previous X.Y.Z>` in `.env` and run `docker compose up -d` (the older image logs "database is newer than this image" and runs, §6); on Render or Railway, set the service's image to that tag. A release whose notes say it is not backward-compatible needs a restore instead. There are no update notifications (nothing phones home); the
admin System panel shows the running version, and the docs point at GitHub
Releases and `SECURITY.md`.

**Backups.** `pg_dump -Fc -Z 6`, never a plain `pg_dump > backup.sql`:
`pg_dump` inherits the server's `bytea_output=hex`, two characters per byte, so
a plain dump of 500 MB of screenshots exceeds a gigabyte. The backup profile
(above) schedules it with retention. **Backups contain secrets** (the stored
auth secret, password hashes, session rows — whose tokens are rejected as
bearer credentials unless signed, §3 — and reset tokens; provider OAuth tokens are never stored): the docs
say to store them like credentials. Per platform: the backup profile on Compose; Render's paid Postgres keeps its own backups (Render Free keeps none, §8 cost table); Railway backs up volumes on Pro, and on Hobby the docs give the `pg_dump` command to schedule.

**Restore**, in full:

1. Stop the app (`docker compose stop app`).
2. Start from an **empty** database on a server of the **same or newer** Postgres major. For the bundled database: `docker compose exec db dropdb -U postgres --force feedbackland && docker compose exec db createdb -U postgres feedbackland`.
3. pgvector must live in the **same schema as in the source**: the dump writes
   types fully qualified (`public.vector(768)`, `public.vector_cosine_ops`), so
   a restore where pgvector sits elsewhere fails with `type "public.vector"
   does not exist` *(measured)*. If the target has no pgvector and the
   restoring user may create it, do nothing: the dump itself creates it in the
   source schema *(measured)*. Where the provider pre-installed it in another
   schema, `ALTER EXTENSION vector SET SCHEMA <source schema>` — pgvector is
   relocatable, but this needs the extension's owner (a superuser, or the
   provider's extension settings) *(measured)*. If you had to create the source
   schema to do that, skip its entry in the dump: `pg_restore -l backup.dump |
   grep -v ' SCHEMA - <source schema> ' > list`, then add `-L list` below.
4. `pg_restore --no-owner --no-privileges --no-comments --single-transaction
   --exit-on-error -d <url> backup.dump`, run from `pgvector/pgvector:pg18` or
   newer (`pg_restore` must be at least as new as the `pg_dump` that wrote the
   file). `--no-comments` because a non-owner cannot `COMMENT ON EXTENSION`;
   `--exit-on-error` because otherwise `pg_restore` carries on past a missing
   object and exits 1 with "errors ignored", and the board would then boot on a
   partial schema whose `kysely_migration` says it is complete *(measured)*.
   For the bundled database: `docker compose run --rm --no-deps --entrypoint
   pg_restore backup -h db -U postgres -d feedbackland --no-owner
   --no-privileges --no-comments --single-transaction --exit-on-error
   /backups/<file>.dump`.
5. Start the app; boot discovers the extension's schema and finds nothing to
   migrate.

**Postgres major upgrades** (bundled database): dump with the backup profile, change the `db` image to the new major and start it — since Postgres 18 the image keeps each major in its own subdirectory (`/var/lib/postgresql/<major>/docker`), so a fresh `19/` cluster initialises beside `18/` in the same volume — then restore; delete `/var/lib/postgresql/18` once satisfied. Removing the volume would destroy the only rollback. The docs give the exact commands.

### Bring-your-own Postgres

pgvector is available on most managed Postgres — RDS, Cloud SQL, Neon,
Supabase, Render (every Postgres 13+) — but not everywhere: **Railway's stock
Postgres does not include it**, **Azure Flexible Server** requires
allowlisting `vector` in `azure.extensions` first, and self-managed Postgres
needs a superuser for `CREATE EXTENSION` (§6). Each is named in the docs with
its extra step. A pooled URL works as `DATABASE_URL` (§6). TLS follows §6.

Making pgvector optional was considered and rejected: the columns and indexes
are in the base schema, and conditional DDL would fork the schema for a
shrinking minority.

### The complete vendor surface

| Dependency | When | Verdict |
|---|---|---|
| **Postgres + pgvector** | runtime, required | The one hard dependency. Postgres 13+; pgvector 0.5.0+ (0.7.0+ above 2,000 dimensions, 0.8.0+ for deep semantic paging) |
| **Next.js** | framework | Open source (MIT), maintained by Vercel; runs as a plain Node server with no Vercel service involved |
| **npm registry** | build | unavoidable for a Node project; also the widget's distribution channel |
| **GHCR / Docker Hub** | distribution | GHCR hosts our image; Docker Hub hosts `node`, `pgvector/pgvector` and `caddy` (anonymous pull limits apply). The Dockerfile is in the repo and `docker build` is a documented path |
| **OpenRouter** | runtime, optional | off by default; the only AI provider, contacted only once an admin connects it, pastes a key or sets `OPENROUTER_API_KEY` (§5) |
| **Google / Microsoft / any OIDC provider** | runtime, optional | only if the operator configures them |
| **Caddy / Let's Encrypt** | optional | open source; any proxy works |
| **Render, Railway, app stores** | optional | convenience paths; the same image runs anywhere |
| **GitHub** | optional | the Render blueprint's live link; release notes |

**Fonts.** `next/font/google` downloads Inter and Roboto Mono at build time,
which needs network access to Google and breaks air-gapped builds — and the
two fonts are **not applied** anyway: `app/globals.css`'s `@theme inline` never
maps `--font-sans`/`--font-mono` to them and nothing references
`var(--font-inter)`, so the board renders the system stacks today. The
`next/font/google` import is **deleted**; nothing is vendored; the board looks
exactly as it does now.

**Zero `NEXT_PUBLIC_*` variables remain** (there are exactly four today:
`NEXT_PUBLIC_SELF_HOSTED`, `NEXT_PUBLIC_SUPABASE_PROJECT_ID`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VERCEL_URL`, all deleted), which
is what lets one prebuilt image serve every operator. `feedbackland-react` has
no build-time environment of any kind. CI asserts the count stays zero.

**Leaving is as easy as arriving.** Identity, content and images live in one
Postgres, so a single `pg_dump -Fc` restored anywhere (procedure above) brings
the board back whole. The one asterisk is avatars, which are provider URLs
(§3).

### Running it somewhere that is not Compose

- **Kubernetes:** no Helm chart. `deploy/kubernetes.yaml` gives a
  Deployment (with the health endpoint as the readiness probe and a `tcpSocket` liveness probe — a database-dependent liveness probe would kill every pod during a database outage; `readOnlyRootFilesystem`, `runAsNonRoot`, and `emptyDir` volumes for `/tmp` and `/app/.next/cache`, mirroring Compose; plus a `startupProbe` whose `failureThreshold × periodSeconds` is at least 1,020 s, covering the 90 s database wait and the 15-minute boot lock), a
  Service, a Secret for `DATABASE_URL`, and an optional Ingress. Replicas are
  safe: boot serialises on the advisory lock and all state is in Postgres.
- **Podman / rootless:** works; `:Z` volume labels under SELinux, and rootless
  cannot bind ports below 1024.
- **Resources:** the target floor is **1 GB RAM and 1 vCPU for app plus
  database**, measured in phase 7 as the peak `docker stats` memory of app plus database during V2 on a board seeded with 1,000 posts while the backfill runs, and stated with the measurement. The Render blueprint's
  `0.5c-512mb` + `0.1c-256mb` (768 MB in total) is below it and marginal — fine
  for a small board, worse at higher embedding dimensions.
- **Non-root:** the image runs as `node` (UID/GID 1000), documented for bind
  mounts.

## §9 — The widget: `feedbackland-react` 3.0.0

`feedbackland-react` resolves a board from `platformId` by building
`https://<platformId>.feedbackland.com`, and posts to
`https://api.feedbackland.com/api/feedback/create` when given no `url`
(`src/lib/resolve-platform-urls.ts:3-4`). Both hosts are retired (§0), so the
fallback is a trap that would point a self-hoster's widget at a dead domain.

**One required prop:**

```tsx
<FeedbackButton url="https://feedback.example.com" />
```

`platformId`, `DEFAULT_BOARD_DOMAIN` and `DEFAULT_API_ENDPOINT` are removed.
`/api/feedback/create` needs no identifier: it requires `{ orgId, description }`
today (`app/api/feedback/create/route.ts:19-22`) and `PopoverWidget` sends
`orgId: platformId` (:108-117). The v3 route requires `{ description }` and
**ignores** an `orgId` field rather than rejecting it, so a 2.x widget that was
given `url` keeps working against a v1 server.

What the removal changes:

- **The resolver** is renamed `resolveBoardUrls` (type `ResolvedBoardUrls`,
  file `src/lib/resolve-board-urls.ts`) —
  "platformUrl" survives in no identifier, which Verification 6 needs — and
  loses its fall-through: today an unparseable `url` warns and falls through to
  the `platformId` branch and then to the defaults, which is why `apiUrl` is
  typed `string` and fetched unguarded. v3 returns an error state, and both
  widgets render a visible configuration error instead of a live wrong
  default. `OverlayWidget`'s local `platformUrl` becomes `iframeSrc`.
- **Paths.** The server supports only the root of a hostname (Non-goals), so v3
  strips a path from `url` and warns. (Supporting paths later means changing
  `apiUrl` to be built from the base instead of the origin **and** the
  server's build-time `basePath`, together.)
- **Mixed content.** An `http:` `url` on an `https:` page is blocked by the browser; today the user waits 15 s for "Loading took longer than expected". v3 detects it and shows the configuration error immediately — except for loopback hosts (`localhost`, `*.localhost`, `127.0.0.0/8`, `[::1]`), which browsers treat as potentially trustworthy and do not block, so a local setup keeps working.
- **Messages.** The only reason for not checking `event.origin` (the old
  `<uuid>` subdomain redirect) is gone; the handshake checks both
  `event.source` and `event.origin`.
- **"Open in new tab"** opens the board without `embed=drawer`, so the new tab
  gets the full board rather than drawer chrome.
- **Slow boards.** A board that takes longer than the 15 s load timeout (a
  sleeping Render free service takes ~60 s) shows "the board is waking up"
  with a retry, not a generic error.
- **The popover** gains a configuration-error state and distinguishes 429 ("too many submissions, try again shortly", or with the `DAILY_LIMIT` code, "new posts are paused until <`resetsAt`, in local time>") from other failures.
- **Dependencies die with it:** `penpal` (imported nowhere in `src`; a stale
  comment at `resolve-platform-urls.ts:11`) and `uuid` (sole consumer
  `validateUUID`, `src/lib/utils.ts:3-4,30-32`).
- **Copy:** `OverlayWidget.tsx`'s error string ("needs a valid `platformId` (UUID) or `url` prop", :410), its `<uuid>` redirect comment (:184-186), its comment at :149-151 and the `console.error` "pass a valid UUID `platformId`…" (:157-166); `PopoverWidget.tsx`'s comment (:71) and its `validateUUID` guard and warning "`platformId` is invalid…" (:95-102); `FeedbackButton.tsx` (:24, :105, :109);
  the resolver's "the org travels in the POST body as `orgId`" comment; and the
  dev harness `src/main.tsx`, which hard-codes a UUID and two `platformId`
  buttons and is excluded from `tsconfig.app.json:31` (so `tsc -b` will not
  catch it breaking).
- **The sandbox comment** states that `allow-same-origin`, `allow-popups` and
  `allow-popups-to-escape-sandbox` are required for sign-in (§3).

**CORS is part of the contract.** The widget POSTs cross-origin, without
credentials, and `/api/feedback/create` answers `Access-Control-Allow-Origin:
*` with an `OPTIONS` handler. v3 of the route: `Allow-Methods: POST, OPTIONS`
(today it lists six methods, four of them unimplemented), `Allow-Headers:
Content-Type`, `Access-Control-Max-Age: 86400` (today every submission
preflights), CORS headers on **every** response including 4xx/5xx (today the
catch block, `route.ts:52-56`, drops them, so a Zod failure reaches the widget
as an opaque CORS error), 400 for validation failures (today 500), and a
response of `{ id }` only (today `returningAll()` hands anonymous callers the
whole row, embedding included). It is an **unauthenticated, instance-wide
write endpoint**; its protections are the rate limits (§1), the body cap (§4),
and moderation when AI is configured.

**This is a real major on a real package** — `2.12.1` → `3.0.0`, with ~10,000
downloads in the past year. Shipping a package whose default points at a dead
domain would be worse than a major bump. Publishing:

- `package.json`: `repository` → `{ url: "https://github.com/feedbackland/feedbackland", directory: "feedbackland-react" }`,
  and `homepage`/`bugs` likewise (today they point at
  `github.com/feedbackland/feedbackland-react`, which 404s, and npm provenance
  would reject the mismatch); `description` ends "…submits feedback to your
  self-hosted Feedbackland board"; the `"saas"` keyword goes.
- `release:react` (`npm version patch -w …`, which cannot cut a major) is
  replaced by the tag-driven workflow in § Release process: tag
  `feedbackland-react@3.0.0` → CI publishes with `--provenance`.
- **`feedbackland-react/README.md`** is rewritten: it is ~111 lines built around
  `platformId`, links `demo.feedbackland.com` (:16), says "Create one free at
  feedbackland.com" (:39), marks `platformId` required and `url` "only needed
  when self-hosting" (:78, :86 — exactly inverted) and tells readers to "keep
  `platformId`" (:90). The rewrite includes a "Migrating from 2.x" section and
  the host-page requirements: HTTPS, and, if the host sends a CSP, `frame-src`
  and `connect-src` entries for the board.
- The admin Widget page's snippet pins `feedbackland-react@^3` and links the
  README **at the running server's version tag**, not `main`.
- **Compatibility rule**, stated in both READMEs: widget 3.x works with server
  1.x; widget ≥ 2.11 given the board's **root** URL as `url` also works (it is the first version that sends `embed=drawer`, commit `bbbd3b4`; the 2.x README told self-hosters to include an org path, which 2.x does not strip); older widgets are unsupported.

## §10 — Runtime configuration reaching the client

In a prebuilt image nothing can be a build-time constant. `getIsSelfHosted()`,
`useIsSelfHosted()`, `SELF_HOSTED` and `NEXT_PUBLIC_SELF_HOSTED` are
**deleted** (five call sites, four in files deleted elsewhere; the fifth,
`components/app/widget-docs/index.tsx:73-76`, builds its snippet URL from
`useVercelUrl()` + `orgSubdomain` and now takes `appUrl` from the context).

### The app URL

`lib/app-url.ts` exports `getAppUrl()`, the single source for every absolute
URL (§1's seven places), resolved in this order:

1. `APP_URL`, if set.
2. `RENDER_EXTERNAL_URL`, if set (Render injects it at runtime).
3. `https://${RAILWAY_PUBLIC_DOMAIN}`, if set.
4. **Otherwise, per request**: the public origin of the current request —
   `x-forwarded-proto` and `x-forwarded-host`, which Next always fills from the
   socket and the `Host` header when a proxy has not. `getAppUrl()` requires
   the request headers in this case, and code without a request (the
   housekeeping loop) has no absolute URL and needs none.

Cases 1–3 are a **resolved** app URL; case 4 is **inferred**. The difference
matters (§3): with an inferred URL, SMTP reset and social sign-in are off.
`window.location.origin` is never a source: the snippet is generated in the
admin UI and pasted into a production site, and an admin working at
`http://10.0.0.5:3000` or through a port-forward would copy a URL the public
cannot reach. Case 4 has the same weakness for an admin on an internal
address, which is why the System panel warns whenever the app URL is inferred
and the Widget page says to set `APP_URL` before copying a snippet.

### The settings payload

There is no server-side settings resolution today — the board layout reads
only the embed header, the board page is static, and the org is fetched
client-side through `trpc.getOrg`, which `selectAll()`s behind a
`publicProcedure` — and there is no SSR prefetch anywhere (no
`HydrationBoundary`, no `dehydrate`, no `createCaller`). A client-fetched flag
would render AI surfaces and then remove them on every cold load, including the
drawer's first open, which is always cold. And the drawer header
(`PlatformHeaderDrawer`, static JSX) fetches nothing, while the feedback form
renders the "improve draft" button whenever the draft has text.

So **`lib/settings.ts`** (server-only, `cache()`d per request, `await
connection()` first) returns an explicit type, and the **board layout**
passes it to `providers/settings.tsx`, which wraps the **entire** board layout
subtree — both branches of `PlatformRoot` and `ProcessAdminInviteParams`,
which sits beside it (`app/[orgSubdomain]/(board)/layout.tsx:19-24`) and
renders the sign-in dialog whose forgot-password form needs `capabilities.smtp`:

```ts
type PublicSettings = {
  platformTitle: string;
  platformDescription: string | null;
  logoUrl: string | null;        // "/api/images/<id>"
  allowIndexing: boolean;
  isSetupComplete: boolean;
  appUrl: string;                 // getAppUrl() for this request
  appUrlInferred: boolean;        // true when no app URL is resolved (the Widget page warns)
  version: string;
  capabilities: {
    chat: boolean;                // capabilities.chat (§5): false past the daily limit's 80% share or while the provider is failing
    embeddings: boolean;          // hasEmbeddings: verified, and the index fingerprint matches
    smtp: boolean;                // SMTP configured and app URL resolved
    socialProviders: Array<"google" | "microsoft" | "oidc">;
    oidcLabel: string | null;
    maxImageBytes: number;
  };
};
```

No secret, setup code or raw environment value is ever part of it. `/setup`,
`/recover`, `/reset-password` and `/auth/popup` live outside the board layout and call
`lib/settings.ts` directly for what they need. After an admin changes a
setting, `useUpdateSettings` calls `router.refresh()`, which re-renders the
layout and `generateMetadata` with the new values. The board icon is the
uploaded logo when there is one (set through `generateMetadata().icons`), else
the neutral `app/icon.svg`.

### The admin System panel

A page under `/admin/system` — read-only apart from **Rebuild search index** and the OIDC discovery retry — shows what the operator otherwise has to
dig out of logs: version; the app URL and its source; AI chat and embeddings
status (model, configured vs column dimensions, last probe result,
items left unscreened in 24 h, rows awaiting embedding, items that can't be indexed) with the **Rebuild
search index** button (§5); SMTP; each sign-in provider, enabled or why not,
with its **callback URI** to copy (and, for OIDC, whether discovery succeeded,
with a retry); the client-IP header; and warnings — recovery enabled; app URL
inferred; a request `Host` that differs from the app URL's host (which makes
sign-in fail, §3); the configured `CLIENT_IP_HEADER` absent from recent requests (`proxy.ts` records the last 100 requests' `Host` and whether that header was present, into the runtime state). AI is **configured** in Settings → AI (§5), which this page links
to; everything else stays in environment variables (Non-goals), and this page
makes it visible.

## §11 — Documentation

**The docs are ahead of the code.** `README.md` (rewritten in `73c5dac`) and
`SELFHOSTING.md` already describe the self-hosted product, and promise
artefacts that do not exist yet: a `render.yaml`, a `compose.yml`,
`ghcr.io/feedbackland/feedbackland`, and `scripts/backfill-embeddings.mjs` (dropped: the backfill is automatic, §5). The work is making the code match the docs, then correcting the docs where this
plan changed the design.

**`SELFHOSTING.md`** gains the sections it defers today, and the corrections:

| Gap or error | Fix |
|---|---|
| no widget integration section | add it: install, props, host-page CSP, the compatibility rule, Safari/iOS session behaviour |
| custom domain + TLS; Google, Microsoft and OIDC sign-in; SMTP reset (placeholders) | write them; every sign-in section gives the exact callback URI and says it changes with the app URL |
| no upgrading section | per platform (§8), plus "back up first" |
| no settings reference | the Environment reference below |
| compose block mounts `db:/var/lib/postgresql/data` — **today's quick start fails at step 2 for everyone** on pg18 | replace the inline block with a download of the committed `compose.yml` (**phase 0**, not later) |
| "set `OPENROUTER_API_KEY`" (:285), and an AI section that starts from environment variables | lead with **Admin → Settings → AI**: **Connect OpenRouter** (or paste a key), adding credit, what is sent, cost and the daily limit, **Keep AI off**; `OPENROUTER_API_KEY` and the other variables as the configuration-as-code alternative that locks the fields |
| costs: "$7/month" (prerequisites), "$7 + $7" (cost table), and "the one-click deploy gives you HTTPS for free" | $13.30/month on Render (§8); $5+ on Railway |
| "the platform takes care of database backups for you" (:207) and "with a database and backups" (:16-17) | false on Render Free, which has none |
| `docker compose pull   # fetch the latest version` | `pull && up -d` |
| `pg_dump > backup.sql`, and restore via `psql` (:191) | `-Fc -Z 6`, the backup profile, and the full `pg_restore` procedure (§8) |
| "deleted after 30 days, no recovery afterwards" | inaccessible at 30 days, deleted at 44 |
| bare `LLM_*=…` blocks with no location | any AI variables go in `.env` beside `compose.yml`, under their new names (Environment reference) |
| the Ollama block and its references (:264-277, :281-282 "or any OpenAI-compatible provider", :302-303 "Option 1 is free too") | deleted: AI goes through OpenRouter only (§5) |
| the backfill tip, `docker compose exec app node scripts/backfill-embeddings.mjs` (:305-309) | deleted: the backfill is automatic (§5 *Backfill and rebuild*) |
| "When it asks for a Setup code, type anything you'll remember" (:37) | "type a code of at least 12 characters you'll remember — a shorter one stops the deploy with an error that says so" |
| "Nothing in Feedbackland needs to change" when adding a domain (:59-61) | set `APP_URL`, update OAuth redirect URIs, re-copy widget snippets |
| a `wget` healthcheck (:120) | the image has no `wget`; use the compose file's |
| "remove the db service" for an external database (:339-341) | use `compose.external-db.yml` or `docker run` |
| "the dump holds everything" (:194; README :90-91) | everything except avatars |
| the "what is sent" table omits edits | add them (§5) |
| "answer two questions" (:9) vs "the one thing" (:39) | one question |
| Windows | `curl.exe` (PowerShell's `curl` is an alias), no `grep` (use `Select-String`) |
| storage growth | images live in Postgres; the database and dumps grow; `MAX_IMAGE_STORAGE_BYTES` |
| Docker installation on a fresh VPS | a two-line pointer to Docker's official install script |

**`README.md`**: the quick start says "you'll be asked for four things" and
never mentions the setup code (:40-41); it becomes five, code first, followed
by "then turn on AI in one step — Connect OpenRouter in Admin → Settings → AI (optional, recommended), or paste a key". The
Railway button is added beside Render's. The AI sentence at :74-78 ("a local model through Ollama — free, open source, and nothing leaves your machine") becomes "optional and recommended, through one OpenRouter account connected in Admin → Settings → AI". The drawer screenshots are
regenerated (they show the full platform header, which `PlatformHeaderDrawer`
replaced). `screenshots/admin_dashboard_*`, which show a removed "AI Roadmap"
tab, and unused screenshots are deleted or regenerated.

**`feedbackland-react/README.md`**: rewritten (§9).

**`.env.example`**: ten lines today, of which one survives: eight are deleted variables (`SELF_HOSTED`, `NEXT_PUBLIC_SELF_HOSTED`, both `NEXT_PUBLIC_SUPABASE_*`, all four `FIREBASE_*`), `OPENROUTER_API_KEY` stays (commented out, noting that Settings → AI is the easier way), and `DATABASE_URL` is deliberately absent (below). It becomes the operator-facing part of the Environment reference
with **every optional line commented out**, so the file documents the defaults
without restating them, and nothing the image sets itself (`PORT`,
`HOSTNAME`, `NODE_ENV`, telemetry). It never contains `DATABASE_URL`: Compose
interpolates `.env` into `compose.yml`, where a `DATABASE_URL` would override
the bundled database's in-network URL.

**`CONTRIBUTING.md`** (new): `docker compose -f compose.dev.yml up -d`; a
`.env.local` with `DATABASE_URL=postgres://postgres:feedbackland@localhost:5432/feedbackland`
(the app itself has no default and fails with `DATABASE_URL is not set`);
`npm run dev` (boot migrates the database); `npm run db:codegen` after changing
`0001`; `npm run db:auth-ddl` after changing auth options; how to run
`scripts/drawer-auth-check.ts` and the `scripts/e2e/` checks; and the
**release checklist** — the manual Verification 5 pass against real Google and
Microsoft, the COOP probe (`curl -sI` both providers' sign-in pages and record
every `Cross-Origin-Opener-Policy*` header; an enforced `same-origin` is
harmless to the handoff but worth knowing), the manual real-OpenRouter 768
check, and release notes stating whether the release contains a migration that
is not backward-compatible with the previous one.

**`SECURITY.md`** (new): how to report a vulnerability (a private GitHub
security advisory), supported versions (the latest minor of the current
major), and the operator-facing facts that matter: backups contain
credentials; per-IP limits are best-effort without a trusted proxy; drawer
tokens are script-readable; the recovery code must be removed after use.

**`package.json`** gains `"license": "MIT"` (the repository is MIT).

**Historical design docs** under `docs/superpowers/` describe the hosted
product; each gets a one-line "superseded by the self-hosted reset" banner, and
`docs/` is excluded from the residue gates.

## Environment reference

Nothing below is required for `docker compose up`. An empty value means
unset, everywhere. `lib/config.ts` is the only module that reads or writes `process.env`, except `instrumentation.ts` (`NEXT_RUNTIME`, `NEXT_PHASE`). CI fails on `process.env`, `process?.env` or `process[` in the app-code scope (`app lib components hooks queries trpc db providers proxy.ts instrumentation.ts next.config.ts`) outside those two files and a **legacy allow-list** of files that still read their own variables until the phase that deletes or rewrites them: `next.config.ts` and `providers/trpc-client.tsx` (until phase 1's rewrite of the latter and phase 2's of the former), `lib/firebase/admin.ts` (3) and `lib/supabase.ts` (5). From phase 1 the five model-calling files (`app/api/chat/route.ts`, `lib/utils-server.ts`, `queries/create-feedback-post.ts`, `trpc/generate-insights.ts`, `trpc/rewrite-feedback.ts`) read the key through `getConfig().llm.apiKey`, which is `undefined` until phase 6, so none of them is on the list. It is empty from phase 5.

**Database**

| Variable | Default | Effect |
|---|---|---|
| `DATABASE_URL` | none in the app (boot fails with `DATABASE_URL is not set`); `compose.yml` supplies the bundled database's URL | **The only hard dependency.** A pooled (transaction-mode) URL is fine (§6). `sslmode`: absent or `disable` → no TLS; `require` → encrypted, unverified; `verify-full` → verified (§6) |
| `DATABASE_SSL_CA` | unset | PEM of a private CA; required for `verify-ca`, used by `verify-full` |
| `DATABASE_POOL_MAX` | `10` | Pool size per process; lower it on small managed databases — minimum 2, `lib/config.ts` rejects less |

**URLs and proxies**

| Variable | Default | Effect |
|---|---|---|
| `APP_URL` | `RENDER_EXTERNAL_URL`, then `https://$RAILWAY_PUBLIC_DOMAIN`, then inferred per request | The public origin. **Required for SMTP reset and social sign-in, and when adding a custom domain** — a resolved URL is also an origin check (§3) |
| `CLIENT_IP_HEADER` | `x-forwarded-for` | The header carrying the client address (§3). Render: `true-client-ip` (observed, undocumented); Railway: `x-real-ip`; Cloudflare: `cf-connecting-ip` |
| `TRUSTED_PROXIES` | unset | CIDRs to skip when walking a multi-value `x-forwarded-for` |

**Auth and first run**

| Variable | Default | Effect |
|---|---|---|
| `BETTER_AUTH_SECRET` | generated and stored | An injected value always wins and is never stored (§6) |
| `SETUP_CODE` | generated | ≥ 12 characters. Wins while unclaimed; ignored after (§7) |
| `RECOVERY_CODE` | unset | ≥ 20 characters. Enables `/recover` (§7). Remove after use |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | unset | Google sign-in (needs an `https:` app URL) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` | unset / `common` | Microsoft sign-in |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_NAME` | unset / "Single sign-on" | Any OpenID Connect provider, by discovery |
| `SMTP_URL` / `SMTP_FROM` | unset | Email password reset. **Both** are required (a made-up sender fails SPF/DMARC), plus a resolved app URL |

**AI** (§5; all optional). Normally configured in **Admin → Settings → AI**
with **Connect OpenRouter**; a variable set here overrides that setting and
locks it in the UI.

| Variable | Default | Effect |
|---|---|---|
| `OPENROUTER_API_KEY` | unset | An OpenRouter key. Setting it turns AI on, unless an admin has turned AI off in Settings → AI |
| `OPENROUTER_MODEL` | `google/gemini-3.8-flash` | Chat model: any OpenRouter model id |
| `OPENROUTER_EMBEDDING_MODEL` | `openai/text-embedding-3-small`; `none` disables | Embedding model; changing it needs **Rebuild search index** (§5) |
| `OPENROUTER_PRIVACY` | unset (the page's setting, default `deny`) | `deny`, `zdr` or `allow`: sets and locks the privacy switches (§5) |
| `AI_EMBEDDING_DIMENSIONS` | `768` | Sizes the column at first boot; requests always ask for the column's width. A later different value stops semantic search until **Rebuild search index** (§5) |
| `AI_SEARCH_MAX_DISTANCE` | measured in phase 6, fixed in `lib/llm/defaults.ts` | Cosine-distance cut-off for semantic search |
| `AI_TIMEOUT_MS` | `15000` | Per-request timeout; insight chunks get 6× |
| `AI_DAILY_CALL_LIMIT` | `5000` (at least 10) | Model calls per UTC day. Every feature but moderation stops at 80%; at the limit anonymous posts are refused until 00:00 UTC (§5) |

**Images**

| Variable | Default | Effect |
|---|---|---|
| `MAX_IMAGE_BYTES` | `4000000` | Per-image cap, decoded bytes, enforced on the server |
| `MAX_IMAGE_STORAGE_BYTES` | unset (unlimited; `render.yaml` sets 600,000,000) | Total image storage ceiling |
| `MAX_PENDING_IMAGE_BYTES` | `200000000` | Ceiling on uploaded images not yet referenced by any post, comment or logo (§4) |

**Set by the image or platform — not operator settings**

| Variable | Value | Note |
|---|---|---|
| `PORT` | `3000` | A platform-injected `PORT` wins (Render, Railway) |
| `HOSTNAME` | `0.0.0.0` | The image's value wins over Docker's injected container id (§8) |
| `NODE_ENV` | `production` | |
| `NEXT_TELEMETRY_DISABLED` | `1` | For `next build`; the runtime has no telemetry |
| `KEEP_ALIVE_TIMEOUT` | `65000` | Above Railway's 60 s edge idle timeout |
| `RENDER_EXTERNAL_URL`, `RAILWAY_PUBLIC_DOMAIN` | platform-provided | Read as app-URL fallbacks |

**Compose and overlay variables** (read by the compose files, not the app):
`POSTGRES_PASSWORD` (bundled database; set before the first `up`; letters and digits only — e.g. `openssl rand -hex 24` — because it is embedded in `DATABASE_URL`, where `p@ss/w#rd` parses as another host *(measured)*),
`FEEDBACKLAND_IMAGE`, `FEEDBACKLAND_PORT`, `DOMAIN` and `COMPOSE_FILE`
(`compose.tls.yml`), `COMPOSE_PATH_SEPARATOR`, `COMPOSE_PROFILES` (`backup` turns the backup profile on without `--profile`), `BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP` (backup profile; at least 1 — at 0 the rotation would delete the new dump too).

**Neutralised at boot, with a warning if set** (Better Auth would read them,
§3): `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`,
`PUBLIC_BETTER_AUTH_URL`, `NUXT_PUBLIC_BETTER_AUTH_URL`,
`NUXT_PUBLIC_AUTH_URL`, `BASE_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`,
`BETTER_AUTH_SECRETS`, `AUTH_SECRET`, `BETTER_AUTH_TELEMETRY`, `BETTER_AUTH_TELEMETRY_ENDPOINT`, `BETTER_AUTH_TELEMETRY_ID`, `BETTER_AUTH_TELEMETRY_DEBUG`, `NEXTAUTH_URL`, `NEXT_PUBLIC_AUTH_URL`, `VERCEL_URL` and `TEST` (§3).

**Deleted:** `SELF_HOSTED`, `NEXT_PUBLIC_SELF_HOSTED`,
`NEXT_PUBLIC_SUPABASE_PROJECT_ID`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
`FIREBASE_DATABASE_URL`, `NEXT_PUBLIC_VERCEL_URL` (`VERCEL_URL` is no longer read by the app, and is neutralised above), and the earlier revisions' `TRUST_PROXY`, `BIND_HOST`, `TRUSTED_ORIGINS`, `PGVECTOR_SCHEMA`, `DIRECT_DATABASE_URL` and `LLM_*`. `OPENROUTER_API_KEY` is kept: it is today's name for the same key.
Today's tree reads exactly thirteen distinct variables (re-verified
2026-09-26), all named in this reference.

## Surfaces to change

Wildcards ("every file carrying `orgId`") cover the bulk. What follows names
every file outside them and every change a wildcard does not imply, each in
the phase that first needs it.

**New**

| Phase | Files |
|---|---|
| 0 | `.dockerignore`, `Dockerfile`, `compose.yml` (without the backup profile), `compose.dev.yml`, `.github/workflows/ci.yml`, `app/api/health/route.ts`, `scripts/ci-gates.ts` |
| 1 | `instrumentation.ts`; `lib/boot/` (index, database wait, migrate with the non-locking adapter, seed, secrets, setup-code helpers, banner: version, URL, database, migrations, setup code); `lib/config.ts`; `lib/runtime-state.ts`; `lib/app-url.ts`; `lib/settings.ts`; `providers/settings.tsx`; `hooks/use-settings.ts`; `trpc/update-settings.ts`; `hooks/use-update-settings.ts`; `lib/housekeeping.ts` (sweeps); `db/migrations/index.ts`, `db/migrations/0001_init.ts`; `db/vector.ts`; `lib/board-href.ts`; `lib/client-ip.ts`; `lib/auth/options.ts` (fields, model names, rate limit, `bearer`, `nextCookies`); `scripts/print-auth-ddl.ts`; `lib/log.ts` (the one server logger: everything server-side logs through it except `lib/boot/`'s last-resort `console.error` before exit; V7-6 enforces it in `lib/llm/`); `scripts/e2e/` (`v1-boot.ts`, which submits `/setup` through the rendered form because a server action needs its `$ACTION_ID_…` field, and runs in its own job since `compose.dev.yml` binds 5432; `v3-lifecycle.ts`, `v7-security.ts`, `v8-search.ts`, `v14-tenancy.ts`) and `scripts/e2e/fixtures/9998_fail.ts`; `ci/compose.pgbouncer.yml`; `queries/get-settings.ts`, `queries/update-settings.ts` (renamed from `get-org` / `update-org`); `components/app/board-state/` (renamed from `global-org-state`) |
| 2 | `app/global-error.tsx`; `app/icon.svg`; `lib/copy-text.ts`; `scripts/drawer-auth-check.ts` (navigation steps) and its fixture host page |
| 3 | `lib/auth/server.ts`, `lib/auth/client.ts`; `app/api/auth/[...all]/route.ts`; `app/setup/`; `lib/auth/popup-handoff.ts` (the `set-auth-token` strip only); `scripts/e2e/v6-urls.ts` (first needed now) |
| 4 | `app/auth/popup/` (start and done pages); `app/reset-password/`; `app/recover/`; `trpc/create-password-reset-link.ts` and its control in `components/app/admins/`; `lib/mail.ts`; `ci/oidc-mock.ts` (plain and COOP-enforcing), `ci/helmet-host.ts`, `ci/compose.https.yml` (a Caddy `tls internal` board at `https://localhost:8443`, also serving `https://board.test:8443` for V18); `ci/compose.mailpit.yml` |
| 5 | `app/api/images/route.ts`, `app/api/images/[id]/route.ts`; `components/ui/minimal-tiptap/upload.ts`; `queries/image-refs.ts`; `scripts/e2e/v4-backup.ts` |
| 6 | `lib/llm/` (constants, defaults, settings store, usage, client, fetch, moderation, titles, embeddings and the query-vector cache, probe, insights, `ask-ai` — the `streamText` call `/api/chat` delegates to — `rewrite`, `check` — the live check — and `openrouter-api` — `/auth/keys`, `/key`, `/models/user`, all through `fetch.ts`); `lib/secret-box.ts`; `trpc/{get-ai-settings,test-ai-settings,save-ai-settings,remove-ai-key,get-ai-status,list-ai-models,connect-openrouter,set-ai-keep-off,dismiss-admin-notice}.ts`; `app/(board)/admin/settings/ai/` (the page and its `return/[nonce]` route); `components/app/ai-settings/` (the page's sections); `components/app/ai-status/` (the header pill, the Activity card, the locked Insights and Ask AI states, the in-context hints); `trpc/start-insights-run.ts`, `trpc/get-insights-run.ts`, `trpc/rebuild-search-index.ts`, `trpc/get-system-status.ts`, `trpc/retry-oidc-discovery.ts`; `app/(board)/admin/system/`; `scripts/mock-llm.ts` (serves as `openrouter.ai`, including `/auth`, `/api/v1/auth/keys`, `/api/v1/key` and `/api/v1/models/user` (with `?output_modalities=embeddings`)); `scripts/fixtures/search-corpus.json`, `scripts/fixtures/moderation-corpus.json`; `scripts/measure-ai.ts`; `scripts/e2e/v2-primary.ts` (V2 and V11 in CI), `v12-broken-key.ts`, `v13-search-index.ts`, `v18-onboarding.ts`; `ci/compose.mock-llm.yml` — a `mock-llm` service running `scripts/mock-llm.ts` on 443 with an `openrouter.ai` certificate from a CA the job generates with `openssl`, while the app gets `extra_hosts: ["openrouter.ai:<mock IP>"]` and `NODE_EXTRA_CA_CERTS` pointing at a read-only mount of that CA; `ci/compose.https.yml` gains `app2` (same image and database) behind Caddy at `https://localhost:8444` — "the second replica" of V12 and V18; `ci/compose.dns-log.yml` (V16) |
| 7 | `render.yaml` (on `main`, and the `render-rc` branch); `deploy/railway/TEMPLATE.md`; `compose.tls.yml`; `compose.external-db.yml`; `.github/workflows/release.yml`; `deploy/kubernetes.yaml`; `CONTRIBUTING.md`; `SECURITY.md`; `ci/compose.private-ca.yml` (V10, with the step that generates its CA); `scripts/e2e/v10-readonly.ts`; `scripts/e2e/fixtures/9999_v3_probe.ts` |
| 8 | `.github/workflows/release-widget.yml`; an HTTPS host page for V15's mixed-content case |
| 9 | the `render-v1` branch; the published Railway template |
| 10 | `deploy/<store>/…` and `scripts/gen-wrappers.ts` |

**Changed**

| Phase | Files and changes |
|---|---|
| 0 | `db/db.ts` (`pool.on("error")`, so a database restart cannot kill the process); `next.config.ts` (`output: "standalone"`, `images: { unoptimized: true }`, `experimental: { isrFlushToDisk: false }`); `app/layout.tsx` (`next/font/google` import and font variables deleted); `package.json` (`engines`, `license`, devDependency `tsx`); `lib/firebase/*` and `lib/supabase.ts` made lazy behind their existing export names (`adminAuth`, `auth` and `supabase` become lazily initialised getters, so no consumer changes) so a secret-less build and container start work — throwaway, deleted in phases 3 and 5; `SELFHOSTING.md` quick start (download the committed `compose.yml`) |
| 1 | `db/db.ts` (`globalThis` pool, sizing, TLS; `DATABASE_URL` through `getConfig()`); `db/schema.ts` (regenerated); `lib/trpc.ts` (org guard and `subdomain` header removed; Firebase token verification removed, so until phase 3 `userId` and `userRole` are null and `adminProcedure` and `/api/chat` answer `UNAUTHORIZED`); `providers/trpc-client.tsx` (no `subdomain` header, no `getVercelUrl()`/`PORT`; a relative `/api/trpc` URL); `proxy.ts` (tenancy removed; embed set-and-strip kept; `_vercel` exclusion removed); `app/[orgSubdomain]/(board)/**` → `app/(board)/**`, including `layout.tsx`, which gains the settings provider; `lib/rate-limit.ts` (§1 table, `lib/client-ip.ts`); `queries/check-rate-limit.ts` (`failClosed`); `queries/create-feedback-post.ts`, `create-comment.ts`, `update-feedback-post.ts`, `update-comment.ts` (write `plainText`; since `getConfig().llm.aiConfigured` is hard-coded false until phase 6, whatever the environment (the banner says `OPENROUTER_API_KEY` is ignored until then), take §5's keyless path — first-sentence title, `general feedback`, no moderation, null embedding); `app/api/chat/route.ts`, `lib/utils-server.ts`, `trpc/generate-insights.ts`, `trpc/rewrite-feedback.ts` (the key through `getConfig().llm.apiKey`; `/api/chat`, `rewriteFeedback` and `generateInsights` answer `AI_NOT_CONFIGURED` while `!aiConfigured`); `queries/get-feedback-posts.ts`, `queries/get-activity-feed.ts` (no query embedding while `!aiConfigured`, so search returns no results until phase 6's `ILIKE`); `trpc/create-comment.ts`, `trpc/update-feedback-post.ts`, `trpc/update-comment.ts` (their §1 caps); the `search-text:*` caps and the 200-character query cut in `queries/get-feedback-posts.ts` and `get-activity-feed.ts`; `queries/save-insights.ts` (writes `status: 'succeeded'`, now NOT NULL); every surviving importer of a module this phase deletes or renames — today `hooks/use-platform-url.ts` is imported by `app/[orgSubdomain]/(board)/admin/page.tsx`, `components/app/activity-feed/list-item.tsx`, `admin-root/index.tsx`, `admins/invite.tsx` (which also sends the removed `platformUrl` input), `ask-ai/citations.tsx`, `ask-ai/thread.tsx`, `feedback-form/index.tsx`, `feedback-post/compact.tsx`, `go-back-button.tsx`, `options-menu.tsx`, `insights/evidence.tsx`, `platform-header/buttons.tsx` and `platform-header/title.tsx`, and `use-org`/`use-update-org` and the deleted setting editors by `platform-header/title.tsx`, `description.tsx`, `settings/index.tsx`, `logo.tsx`, `platform-title.tsx` and `platform-description.tsx`; the fallout of regenerating `db/schema.ts` — `photoURL` → `image` (`queries/get-comment.ts:33`, `get-comments.ts:45`, `get-feedback-post.ts:36`, `get-activity-feed.ts:97,124`, `get-user-session.ts:27,48`, `platform-header/buttons.tsx:107`), `session.userOrg.role` → `session.user.role` (`buttons.tsx:141`), and `authorId`/`authorRole` becoming `string \| null` with a null author rendered as deleted (`comment/index.tsx:13,18`, `comment/inner.tsx:15`, `comment/options-menu.tsx:37`); in phases 1–4 the Settings page does not render `Logo` and the header shows no logo (the `logo` column is gone; `logoImageId` arrives with uploads in phase 5); every file Verification 6's pattern matches, comments included (today `app/globals.css:231`, `platform-root/index.tsx:15,22`, `platform-header/drawer.tsx:3`, `settings/loading.tsx:44,50`, `hooks/use-platform-ready.ts:28`, `(board)/admin/ask-ai/page.tsx:10`); after the route move, delete `.next/` locally (`tsconfig.json` includes `.next/types`, which still import the old paths); `lib/utils.ts` (tenant and URL helpers removed); `lib/schemas.ts` (`upsertUserSchema`, `claimOrgSchema`, `orgSubdomainSchema` removed); `lib/typings.ts` (`UpsertUser`, `ActivityFeedItem.orgId`, `IframeParentAPI` removed); `lib/atoms.ts` (`iframeParentAtom` removed); `lib/api-snippets.ts`, `lib/widget-snippets.ts`, `lib/ask-ai.ts` (`appUrl`); `components/app/api-docs/*` (no org id; `endpoint-card.tsx` uses `appUrl`); `components/app/widget-docs/index.tsx` (until phase 8 its preview, and the snippet from `lib/widget-snippets.ts`, pass `platformId=""` with `url={appUrl}` (the snippet with a comment that the server ignores it), because the workspace widget is 2.x, whose `platformId` is a required prop, and 2.x resolves a parseable `url` first); `components/app/ask-ai/index.tsx` and `storage.ts` (no `subdomain` header; a constant conversation key — today it keys on `getSubdomain()`, which returns null on two-label hosts and disables saving); `trpc/create-admin-invite.ts` (server-derived URL, `URLSearchParams`); `hooks/use-auth.tsx` (stops calling the deleted upsert route; `orgSubdomain`/`getSubdomain` and the demo auto-login removed; `import type` from `db/schema`); `lib/firebase/admin.ts` (`getIsSelfHosted` guard and `adminDatabase` removed); `app/api/chat/route.ts` and `app/api/trpc/[trpc]/route.ts` (`maxDuration` and the org lookup removed); `app/api/feedback/create/route.ts` (the §9 contract: `{ description }` only, `orgId` ignored, CORS on every response, 400 on validation, `{ id }` response, `Allow-Methods`, `Max-Age`); every file carrying `orgId`; the 37 surviving bare-`"server-only"` files and the modules §2 lists; `package.json` (add `better-auth` 1.7.6 exact; remove `next-safe-action`, root `penpal`, `kysely-ctl`, `overrides.jose`, the `migrate-*` and `schema-dump` scripts; rename `kysely-codegen` to `db:codegen`; add `db:auth-ddl`); `.gitignore` (the `/supabase` line; `.vercel` stays while the maintainer still runs the `vercel` CLI, until phase 9) |
| 2 | `next.config.ts` (`headers()`; Supabase `remotePatterns` removed); `lib/embed-surface.ts` (`string[]`) and its callers — `proxy.ts` (`parseEmbedSurface(req.nextUrl.searchParams.getAll(EMBED_PARAM))`) and `app/(board)/layout.tsx` (passes `header ? [header] : []`); `providers/embed.tsx` (any-match, corrected comment); `app/layout.tsx` (boot script any-match; the static root `metadata`); `components/ui/tiptap-output.tsx` (anchors open in a new tab; `<img>` fallback; status spans, §2); `components/app/process-admin-invite-params/` (no `location.reload()`); `components/app/admin-root/index.tsx` (refuses to render framed; `TAB_WIDTHS` derived from the visible tabs); the `[postId]` page (a server component; `notFound()` for non-UUIDs); `clean()` in `lib/utils-server.ts` (status spans, §2); the board layout's `generateMetadata` (title, robots from `allowIndexing`, `metadataBase`, icons); `components/app/settings/` (an indexing toggle); `components/app/feedback-post/options-menu.tsx` and the post and comment admin controls (`feedback-post/compact.tsx:53`, `comment/options-menu.tsx:88`; hidden when embedded); every copy site (§2, *Copy to clipboard*); `package.json` (devDependency `playwright`) |
| 3 | `lib/auth/options.ts` (hooks, `databaseHooks`, telemetry, IP options, `popupHandoff()` in the plugin list); `lib/trpc.ts` (`createContext` session; the admin rule of §3); `app/api/chat/route.ts` (the admin rule; `ask-ai:*` caps; the CSRF gate of §3); `app/api/trpc/[trpc]/route.ts` (the CSRF gate); `lib/boot/` (`verifySetupCode`, `clearSetupCode`); `app/(board)/layout.tsx` (the `/setup` redirect); `hooks/use-auth.tsx` (rewritten on Better Auth); `hooks/use-platform-ready.ts`; `providers/trpc-client.tsx`; `components/app/ask-ai/index.tsx` (transport credentials); `components/app/sign-in/*`, `sign-up/*`, `sso/*`, `sign-up-in/*`, `forgot-password/form.tsx`, `account-settings/*`; `components/app/platform-header/drawer.tsx` (signed-in indicator, sign out); `queries/redeem-admin-invite.ts` (server email match, expiry); `trpc/update-user.ts`; `feedbackland-react/src/OverlayWidget.tsx` (sandbox comment only); `scripts/drawer-auth-check.ts` (auth steps); `package.json` (remove `firebase`, `firebase-admin`); `.dockerignore` (drops `firebaseConfig.ts`) |
| 4 | `lib/auth/options.ts` (`genericOAuth`, the account token hooks); `lib/auth/popup-handoff.ts` (the `start`/`claim` endpoints and the social and callback hooks); `lib/auth/client.ts` (the popup handoff client); `components/app/sign-in/*` and `sign-up/*` (provider buttons from `capabilities.socialProviders`); `components/app/admins/*` (reset links); `lib/boot/` banner (SMTP, providers); `package.json` (`nodemailer`, `@types/nodemailer`, `oauth2-mock-server`, `helmet`); `scripts/drawer-auth-check.ts` (social steps) |
| 5 | `lib/utils.ts` (image helpers deleted); `components/ui/minimal-tiptap/hooks/use-minimal-tiptap.ts` (`uploadFn`, paste, drop, caps); `components/ui/minimal-tiptap/extensions/image/components/image-view-block.tsx` (natural size kept, resize handles removed); `…/utils.ts` and `…/extensions/file-handler/index.ts` (the 25 MB input cap); `…/extensions/image/image.ts` (absolute copy link); `components/app/settings/logo.tsx` and `components/ui/image-cropper.tsx` (`logoImageId`); `components/app/feedback-form/*`, `comment-form/*`, `feedback-post/edit.tsx`, `comment/edit.tsx`; `clean()` in `lib/utils-server.ts`; `queries/create-feedback-post.ts`, `create-comment.ts`, `update-feedback-post.ts`, `update-comment.ts` (image references); `app/api/trpc/[trpc]/route.ts`, `app/api/feedback/create/route.ts` (the 256 KB streaming body cap) and `app/api/auth/[...all]/route.ts` (64 KB); `package.json` (remove `@supabase/supabase-js`) |
| 6 | `lib/utils-server.ts` (model code moves to `lib/llm/`; `clean()` stays); `queries/check-rate-limit.ts` (`consumeAiBudget`); `lib/rate-limit.ts` (`ai-check:user`; the 429 `DAILY_LIMIT` path for anonymous posts); `app/api/feedback/create/route.ts` (429 `DAILY_LIMIT`); `app/(board)/admin/layout.tsx` (already a server component; it becomes `async` and resolves `getAiStatus` — calling `requireAdminSession` — before rendering `AdminRoot`); `queries/create-feedback-post.ts`, `create-comment.ts`, `update-feedback-post.ts`, `update-comment.ts` (moderation outcomes; models outside transactions; creates and edits write vectors through `writeEmbedding`, and edits set `"updatedAt" = now()`); `scripts/drawer-auth-check.ts` (discovery retry); `queries/get-feedback-posts.ts`, `get-activity-feed.ts` (`vectorDistance`, `ILIKE` branches, iterative scan, threshold, search-cap and budget fallback, the query-vector cache, the **Unscreened** filter); `trpc/rewrite-feedback.ts`; `app/api/chat/route.ts` (delegates to `lib/llm/ask-ai.ts`; the 1 MB cap); `components/app/admin-root/index.tsx` (the status pill, "off" markers on the Insights and Ask AI tabs); `components/app/insights/*` and `components/app/ask-ai/*` (their off states); `components/app/activity-feed/*` (the off card, the broken card, the search hint, the unseen notice, the **Unscreened** filter); `components/app/settings/index.tsx` (the *Board* and *AI* sections); `app/setup/` (lands on the AI step); `components/app/feedback-form/*` (improve-draft gating; its label becomes the outcome-first "Improve my draft", replacing "Let AI polish your feedback" at `feedback-form/index.tsx:63,215`); `lib/housekeeping.ts` (backfill, probe retry, the credit wait, stale insight runs); `lib/boot/` (probe, AI banner lines); `lib/config.ts` (AI fields from `ai_settings` with the 5-second cache); `hooks/use-generate-insights.ts` (starts a run and polls `getInsightsRun`); `package.json` (add `@ai-sdk/openai-compatible` 3.0.48 exact; remove `@openrouter/ai-sdk-provider`, `@ai-sdk/openai`, `@ai-sdk/google`) |
| 7 | `compose.yml` (the backup profile); `.gitignore` (`/backups`); `package.json` (the already-unused packages of §5 and the `components/ui/*` sweep; version `1.0.0-rc.1`); `.env.example`; `README.md` (Railway button, five fields, the AI paragraph); `SELFHOSTING.md`; the "superseded" banners on `docs/superpowers/*` |
| 8 | `feedbackland-react/*` (3.0.0, §9) including `README.md`, `package.json` (metadata; remove `penpal`, `uuid`, `@rollup/plugin-commonjs`), `src/main.tsx` and the `resolve-board-urls.ts` rename; the root `package.json` (`release:react` removed); `components/app/widget-docs/*` and `lib/widget-snippets.ts` (snippet pins `^3`, versioned README link; the interim `platformId=""` removed); `scripts/drawer-auth-check.ts` (the packed widget) |
| 9 | `package.json` (version `1.0.0`); `.gitignore` (drops `.vercel`) |

The tRPC router (`trpc/index.ts`) registers each new procedure in the phase
that adds it (`updateSettings` in 1; `createPasswordResetLink` in 4;
`startInsightsRun`, `getInsightsRun`, `rebuildSearchIndex`, `getSystemStatus`, `retryOidcDiscovery` and the AI page's `getAiSettings`, `testAiSettings`, `saveAiSettings`, `removeAiKey`, `getAiStatus`, `listAiModels`, `connectOpenRouter` (a sub-router: `start`, `finish`), `setAiKeepOff` and `dismissAdminNotice` in 6) and drops `getOrg`/`updateOrg` in 1 and `generateInsights` in 6.

**Deleted**

| Phase | Files |
|---|---|
| 1 | `app/get-started/`; `app/[orgSubdomain]/claim/`; `app/[orgSubdomain]/form/` and `components/ui/field.tsx`; `app/[orgSubdomain]/(board)/admin/ai-roadmap/`; the seven empty directories (§2); `components/app/create-org-wizard/` (6 files); `components/app/settings/platform-url.tsx`, `org-name.tsx`, `org-url.tsx`; `app/api/org/[orgId]/`; `app/api/user/upsert-user/`; `queries/{claim-org,create-org,get-org-subdomain,get-user-org-role,get-user-with-role-and-org,has-claimed-org,upsert-user}.ts`; `trpc/{get-org,update-org}.ts`; `hooks/{use-subdomain,use-maindomain,use-vercel-url,use-is-self-hosted,use-sse,use-platform-url,use-org,use-update-org}.ts`; `providers/iframe.tsx`; `components/ui/minimal-tiptap/components/image/image-edit-{block,dialog}.tsx` and `…/section/five.tsx`; `db/schema.sql`; `db/migrations/*.sql`; `.config/kysely.config.ts`; `lib/safe-action.ts` |
| 2 | the five unused `app/*.png` icons, the six `public/feedbackland_logo*` files, `FeedbacklandLogoFull`, `app/favicon.ico` (replaced by `app/icon.svg`) |
| 3 | `firebaseConfig.ts` (commits a live Firebase web API key; §0 retires the project); `lib/firebase/` |
| 5 | `lib/supabase.ts` |
| 6 | `trpc/generate-insights.ts` (its body moves to `lib/llm/insights.ts`) |
| 7 | the unused `components/ui/*` files (the list is recorded in the phase's PR); the stale screenshots (§11) |

## Delivery plan

Each phase lands as one or more PRs to the `single-tenant-self-hosting`
branch; from phase 7 on, PRs target `main`. The branch merges to `main` after phase 6's gate (phase −1 having
disconnected Vercel) and before `v1.0.0-rc.1`, which is tagged on `main`.
Every gate is a set of Verification checks that must pass in CI or, where
marked *manual*, be walked and recorded in the PR. A phase's checks are added to `ci.yml` in the PR that makes them pass and block from that PR on; every PR keeps all earlier phases' checks green; a phase is complete when its whole gate is green on the branch. **Phase 7 lands in order**: (1) the machinery, gated by V4 (full), V7 (phase 7) and V10; (2) make the package public (created private by (1)'s `:edge` push), then tag `v1.0.0-rc.1` on `main`; (3) the PR adding V3's upgrade and rollback leg, which pulls rc.1; (4) V9 against rc.1. A failure at (3) or (4) is fixed on `main` and ships as rc.2, while V3's old side stays rc.1.

**Phase gates never test a published image in place of the one under test.** Every container check uses the image built earlier in the same CI run, tagged `feedbackland:ci` and passed to the compose files as `FEEDBACKLAND_IMAGE`. The only published images a gate pulls are `:1.0.0-rc.1`, as the old side of V3's phase-7 upgrade, and `:1` in phase 9's V9 smoke.

**Until phase 6, only the keyless path is supported.** The model code is
rewritten in phase 6; the old OpenRouter calls (no `dimensions`, a 3,072-wide reply into a 768
column) would fail, so `getConfig().llm.aiConfigured` is hard-coded false until
then and a `.env` that already sets `OPENROUTER_API_KEY` (the maintainer's does,
§0) changes nothing. All gates before phase 6 run with no model configured.

| # | Phase | Deliverables | Gate |
|---|---|---|---|
| −1 | **Pre-flight** (out of tree, §0) | Vercel Git integration disconnected (project kept); npm maintainer email moved off the domain, 2FA on; domain renewals committed; hosted signups frozen and hosted boards notified; the hosted-era `.env` moved out of the checkout (§0 step 8) | V0 (pre-flight) |
| 0 | **Foundations** | `.dockerignore`, `Dockerfile`, `compose.yml`, `compose.dev.yml`, `/api/health`, `ci.yml`, `scripts/ci-gates.ts`; `next.config.ts` (`standalone`, `unoptimized`, `experimental.isrFlushToDisk`); `next/font/google` removed; `db/db.ts`'s `pool.on("error")`; Firebase and Supabase clients made lazy; `tsx`, `engines`, `license`; `SELFHOSTING.md`'s broken compose block replaced by a download | V1 (static), V16, V7 (phase-0 items), V10 (`HOSTNAME`/`PORT` leg). `/api/health` is 200 under `compose.yml` and 503 after `docker compose stop db` — blocking in every phase: boot waits for the database only at start, and a running server answers 503 when its database stops |
| 1 | **Single tenant, schema, boot** | the route move to `app/(board)`; the org removal everywhere (§1) including `/api/user/upsert-user` and `getIsSelfHosted`; `better-auth` installed, `lib/auth/options.ts` and `scripts/print-auth-ddl.ts`; `0001_init` with the full target schema; `instrumentation.ts`, `lib/boot/`, `lib/config.ts`, `lib/runtime-state.ts`; `db/db.ts`; `db/vector.ts`; settings read/update and provider; `lib/app-url.ts`; `lib/client-ip.ts` and the rate-limit table; `lib/housekeeping.ts` (sweeps); `plainText` writes and the keyless write path; in-board links through `boardHref()` (§1); the `/api/feedback/create` contract; `server-only` imports; `board-state`; dead code; `db/schema.ts` regenerated; `scripts/e2e/` and `ci/compose.pgbouncer.yml` | V1 (static and boot smoke, before the auth steps), V6 (server scope), V14, V8 (migration convergence), V3 (persistence, failing migration, concurrent boots), V7 (phase-1 items) |
| 2 | **Framing, embed signal, metadata** | `headers()`; the remaining full-load hazards (§2, *The embed signal must survive navigation*); any-match embed parsing; `global-error.tsx`; user links open in a new tab; `AdminRoot` refuses when framed; admin controls hidden when embedded; metadata, `allowIndexing`, icons, `notFound()` for non-UUIDs; `lib/copy-text.ts`; `playwright` and `scripts/drawer-auth-check.ts` (navigation steps) | V7 (phase-2 items), V5 (navigation steps, Chromium, signed-out drawer) |
| 3 | **Better Auth and first run** | §3's configuration and the credential model (session `scope`, the admin rule, the `set-auth-token` strip); token store; email sign-up/in/out; drawer sign-out; pre-setup lockdown; `/setup` and its code rules; the `/setup` redirect; invite expiry and server match; Firebase deleted; the drawer check's auth steps | V1 (including `/setup` and a second sign-up — the schema-drift check — and the `compileMigrations()` diff), V5 (email/password, all three engines), V7 (phase-3 items), V2 (*manual*, skipping search and images) |
| 4 | **Social sign-in and recovery** | Google, Microsoft, OIDC behind configuration; `popupHandoff`; provider buttons from capabilities; `/reset-password`; SMTP tier; admin reset links; `/recover`; provider tokens nulled; `ci/oidc-mock.ts`, `ci/helmet-host.ts`, `ci/compose.https.yml`, `ci/compose.mailpit.yml` | V5 (social: mock IdP plain and COOP-enforcing, Helmet host page, the HTTPS board, all three engines), V7 (phase-4 items). Real Google and Microsoft are walked per release from phase 7 (they need OAuth clients registered for a public HTTPS board, a Mac and an iPhone), not in this gate |
| 5 | **Images** | §4 in full; `scripts/e2e/v4-backup.ts`; Supabase deleted | V7 (phase-5 items), V4 (with an image; search excluded), V2 (*manual*, with images) |
| 6 | **AI** | §5 in full: `lib/llm/`, moderation outcomes, `ILIKE`, embeddings and dimensions, backfill, rebuild, background insights, the System panel; **Settings → AI** (Connect OpenRouter with its credit step, or paste a key; defaults, the live check, privacy, usage, the daily limit and its anonymous-posting pause, **Keep AI off**) and everything that tells the admin AI is off or failing; `AI_SEARCH_MAX_DISTANCE` measured and fixed; the test harnesses (`mock-llm`, the search corpus) | V11, V12 (with its *manual* real-OpenRouter check), V13, V18, V5 (discovery retry), V16 (runtime egress), V8 (search, `EXPLAIN`, paging past 40), V2 (CI from here), V7 (phase-6 items). **Then merge to `main`**. The phase lands in two parts: **6a**, the AI engine configured through environment variables (every check above except V18, V11's admin-surface assertions and V16's Settings → AI visit), and **6b**, Settings → AI and the admin notices (V18 and those two legs); the merge follows 6b |
| 7 | **One-click, release machinery, operations** | `render.yaml` and the `render-rc` branch, the Railway template spec, `compose.tls.yml`, `compose.external-db.yml`, the backup profile, `release.yml`, `deploy/kubernetes.yaml`, the dependency cull, `.env.example`, `CONTRIBUTING.md`, `SECURITY.md`, README and SELFHOSTING; make the GHCR package public, then tag **`v1.0.0-rc.1`** | V9 (*manual*, against `rc.1` on both platforms), V10, V3 (upgrade and rollback), V4 (full), V7 (phase-7 item); the resource floor measured and stated |
| 8 | **Widget 3.0.0** | §9 in full; `release-widget.yml` | V15, V5 (against the packed widget) |
| 9 | **Release and retirement** | tag `v1.0.0`; publish `feedbackland-react@3.0.0`; create the `render-v1` branch and publish the Railway template on `:1`; §0 steps 5–8; `.gitignore` drops `.vercel` | V0 (retirement), V9 (*manual* smoke from the README buttons, with an anonymous pull), V6 (full scope) |
| 10 | **App-store wrappers** | `scripts/gen-wrappers.ts`, `deploy/<store>/` for Umbrel, CasaOS, Coolify, Dokploy, Easypanel, Zeabur, CapRover | V17 per store (*manual*); CI wrapper-drift check |

**Accepted interim states**, written down so nobody debugs them:

- **Phases 1–2: nobody can sign in, and there is no admin.** Phase 1 deletes
  `user_org` and the upsert route while Firebase survives until phase 3, and
  Better Auth's `user` table has no Firebase users. Anonymous posting works
  (keyless); the gates test only public behaviour.
- **Phases 1–2: there is no `/setup`**, and the board does not redirect.
- **Phases 1–4: uploads still go to Supabase** through the lazy client and
  fail without its credentials; the logo cannot be changed (`settings` holds
  only `logoImageId`). No gate before phase 5 uploads.
- **Phases 1–5: AI must stay unconfigured** (above), and **search returns nothing**: there are no embeddings and the `ILIKE` fallback arrives in phase 6.
- **Phases 3–6a: `/setup` lands on `/admin`**; the AI step arrives in phase 6b.
- **Phase 3: the Google and Microsoft buttons are hidden**; they return, gated by configuration, in phase 4.
- **Phases 0–8: `compose.yml` and `SELFHOSTING.md` name `:1`, which exists from phase 9**; until then compose checks use `FEEDBACKLAND_IMAGE`.
- **Phases 7–8: the README buttons point at the `render-v1` branch and the Railway template**, which exist from phase 9.

## Release process

- **Server:** a `vX.Y.Z` tag on `main` builds both architectures on native
  runners and publishes `ghcr.io/feedbackland/feedbackland:X.Y.Z`, `:X.Y`,
  `:X` and `:latest`, then performs an anonymous `docker pull` and fails if the
  image is not public. A `vX.Y.Z-rc.N` tag publishes only `:X.Y.Z-rc.N`. Pushes
  to `main` publish `:edge` (from phase 7), for manual testing only.
- **Visibility:** the first publish — the `:edge` push that merges `release.yml` — creates the GHCR package as **private**. Making it public is a one-time, irreversible manual step in phase 7, done then, before `v1.0.0-rc.1` is tagged; an rc being public is harmless. rc tags skip the anonymous-pull check, which runs with an empty `DOCKER_CONFIG`. (The
  `feedbackland` GitHub namespace is a user account, not an organisation;
  GHCR works the same for both.)
- **Widget:** a `feedbackland-react@X.Y.Z` tag publishes that version with `npm publish --provenance` from `release-widget.yml`, through npm **trusted publishing** (configured for that workflow in phase 8, out of tree; phase −1's 2FA leaves no other publish credential). App and widget tags never collide.
- **Guards:** both release workflows fail unless the tag equals the matching `package.json` version and the tagged commit is an ancestor of `main`.
- **Supply chain:** the image is built with `provenance: mode=max` and an SBOM, and signed with keyless cosign; every GitHub Action is pinned by commit SHA; Dependabot security updates are on, and an advisory against an exactly pinned package blocks a release.
- **Versions:** the server's `package.json` version is the release version (`1.0.0-rc.N` at an rc tag, `1.0.0` at phase 9); the running version is shown in the banner,
  `/api/health` and the System panel.
- **The release checklist** lives in `CONTRIBUTING.md` (§11).

## Risks

| Risk | Mitigation | Proven by |
|---|---|---|
| A later full load inside the drawer is refused (upgrade, error, link) | Embed signal kept by `boardHref()`; user links open in new tabs; a custom global error page (§2) | V5 |
| `?embed=x&embed=drawer` frames standalone chrome | Any-match parsing in all readers (§2) | V7 |
| Header row order disables the image sandbox or the drawer | Order fixed, commented, asserted on full values | V7 |
| Boot code cannot load its dependencies in the image | Boot runs inside the Next bundle from `instrumentation.ts`; no runtime scripts (§6) | V1 |
| Boot state or the pool is duplicated per bundle layer | `globalThis` pool and `lib/runtime-state.ts` (§6) | V12, V13 (capabilities seen by requests) |
| A thrown boot leaves a server answering 500 | `register()` catches and exits (§6) | V1 (unreachable database exits) |
| Settings read leaks the auth secret or setup code | `instance_secret` table read only by `lib/boot/`; explicit-column settings reads | V7 |
| Every browser sign-in refused with `INVALID_ORIGIN` when no app URL is set | `trustedProxyHeaders` when inferred; platform URL fallbacks (§3) | V2, V5 (email and password at `http://localhost:3000` with no `APP_URL`, phase 3) |
| A custom domain without `APP_URL` refuses sign-in | Docs; System panel warns on a host mismatch | V9 |
| Emailed links poisoned through `X-Forwarded-Host` | SMTP and social sign-in require a resolved app URL | V7 |
| All users share one auth rate-limit bucket behind a multi-hop proxy | `CLIENT_IP_HEADER` / `TRUSTED_PROXIES`, one resolver, per-platform defaults | V7 |
| Per-IP limits spoofable with no proxy | Stated; instance caps bound cost; setup and recovery rely on code strength and fail closed | V7 (fail-closed) |
| A stolen drawer token is used as an admin credential (as a bearer **or** a forged cookie) | Admin requires a `first-party` session younger than 7 days; `scope` is immutable (§3) | V7 |
| Page script reads a first-party session token | `set-auth-token` stripped from non-embedded responses | V7 |
| Raw tokens from a database, a backup or `/list-sessions` are live credentials | `requireSignature: true` rejects them as bearer and cookie | V7 |
| Popup `window.opener` severed by host COOP or an IdP enforcing COOP | Server-mediated handoff with polling (§3) | V5 (COOP mock, Helmet host); release-checklist probe |
| A crafted link collects a signed-in visitor's session through the popup pages | Binding inside the OAuth callback via server-held state; `/auth/popup/done` binds nothing; `Sec-Fetch-Site` gate on `/auth/popup` | V7 |
| Handoff phished (a victim completes a crafted flow) | `Sec-Fetch-Site` gate; confirmation; `embedded` scope; single-use claim; residual risk accepted | V7 (gate, replay, wrong secret, expiry) |
| OAuth errors never reach the drawer | `errorCallbackURL` through the ticket | V5 (`account_not_linked`) |
| XSS on the board steals a drawer token | Admin power needs a first-party session; signed tokens; sanitisation on both ends; CSP tracked follow-up | V7 (admin refusal) |
| Safari/iOS/Brave drawer sessions end with the browser session | Browser policy; stated in the widget docs (§3) | V5 (*manual* Safari pass) |
| Schema drift between Better Auth's options and the committed DDL takes tRPC down | DDL generated from the pinned version; runtime validation on; CI setup + sign-up and a `compileMigrations()` diff | V1 |
| OIDC discovery fails once and the provider silently disappears | Enabled state from Better Auth's own list; System panel retry | V5 (phases 4 and 6) |
| `next build` needs a secret or a database | Lazy `getAuth()`; `connection()` in settings; no metadata route reads the database | V16 |
| A newer database crashes an older image | "Database ahead" detection skips migrating; backward-compatible migrations from `rc.1` | V3 |
| A failed migration half-applies, hides its error, or leaves a lock | One transaction; non-locking Kysely adapter; `.error` checked (§6) | V3, V8 (through PgBouncer after a failure) |
| pgvector outside `public` breaks search or a restore | Schema-qualified operator; restore relocates the extension | V8, V4 |
| Semantic "load more" truncates at 40 results | `hnsw.iterative_scan` (≥ 0.8.0) or `ef_search = 400`, inside a transaction | V8 |
| `sslmode=require` fails against private-CA providers, or the URL overrides TLS | `db/db.ts` strips SSL parameters and builds TLS itself | V10 |
| An exhausted or invalid key rejects posts as "inappropriate" | Moderation's *unavailable* outcome on every path | V12 |
| Exhausting the provider's quota disables moderation | Stated as an explicit bypass; rate limits bound it; `moderation_event` records each item and Activity lists them | V12 |
| The AI transport calls the Responses API or drops Ask-AI's cache breakpoint | `@ai-sdk/openai-compatible`; `transformRequestBody` for the breakpoint | V12 |
| A bare model id routes to Vercel's AI Gateway | Provider objects only; `AI_SDK_DEFAULT_PROVIDER` set; CI grep | V7, V16 |
| The default key-only install embeds at the wrong width | `dimensions` always sent; default model verified to honour it | V12 |
| A misconfigured or unreachable model takes the board down | Nothing about AI can stop boot (§5) | V13 (mismatch case) |
| Admins never turn AI on because they don't know what they're missing, or find it hard | The post-setup step, the header pill, the Activity card, the explained Insights and Ask AI pages and in-context hints, each starting the one next step directly; nothing to choose; applied without a restart (§5) | V18 |
| The stored AI key leaks from the database or a backup | Encrypted with a key derived from the auth secret; never returned by any API; the honest limit (a generated secret lives in the same database) stated, and a provider spend limit recommended and linked | V18 |
| The privacy switch misses embedding requests | `lib/llm/fetch.ts` merges `provider` into every `/embeddings` body | V12 |
| OpenRouter is down or unreachable | AI is optional; moderation takes its *unavailable* path and nothing about AI can stop the board or posting; the pill and the broken card say so | V12, V13 |
| A new OpenRouter account has no credit, so turning AI on stalls | The credit step: stated before and after connecting, and AI turns on by itself when credit arrives | V18 |
| AI runs up an unbounded bill | A daily limit (default 5,000) counted per UTC date, only allowed calls counted, moderation reserved the last 20%; typical and worst-case cost shown; key spend limit shown and linked | V18 |
| A flood exhausts the daily limit | Features stop at 80%; at the limit anonymous posts are refused (429) rather than published unscreened; signed-in content is recorded; **Raise the daily limit** | V18 |
| A poison row makes the backfill spend the budget | `embeddingSkipped`, batch halving, backoff | V12 |
| Vectors from two models mix in one index | Index fingerprint; generation-tagged writes; a mismatch stops semantic search until Rebuild | V13, V18 |
| The board ends up connected to someone else's OpenRouter account (their code or key), so its prompts reach them | Encrypted verifier bound to the admin; **Confirm it's yours**; warnings on the fields. Residual, stated: an admin can paste a key someone else controls | V18 |
| Admins who decline AI are nagged forever | **Keep AI off**; per-admin dismissals | V18 |
| Keyless boards contact openrouter.ai for prices | Prices from OpenRouter only once a key is connected or pasted; a dated snapshot otherwise | V16 |
| SVG or disguised upload executes script same-origin | Magic-byte detection, sandbox CSP, `nosniff` | V7 |
| Unbounded bodies exhaust memory | Streaming caps on `/api/images`, `/api/trpc`, `/api/feedback/create`, `/api/auth/*`, `/api/chat` | V7 (phases 5, 6) |
| Pasted external images become tracking pixels | Sanitiser keeps only local image references | V7 |
| The TLS overlay leaves port 3000 open, or is lost on upgrade | `ports: !reset []`; `COMPOSE_FILE` in `.env` | V7 |
| A failing backup rotates good ones out | `.partial` rename on success only | V4 (phase 7) |
| A developer's `.env` ships in the public image | Allow-list `.dockerignore` | V7 |
| The first release image is private | Release job's anonymous-pull check; public from phase 7 | release job |
| A `render.yaml` change reaches every linked instance | The button deploys the frozen `render-v1` branch | process control; no automated check |
| Render's default 15 GB disk raises the bill | `diskSizeGB: 1`; cost stated | V9 |
| Render's free Postgres deletes the board at 44 days with no backups | Stated up front, with the real paid price | docs |
| Vercel still deploys `main` | Phase −1 disconnects it before any merge | V0 |
| A lapsed `feedbackland.com` hands its buyer an iframe on customers' sites and the npm account | Domain kept; npm email moved; 2.x deprecated (§0) | process control; no automated check |
| The widget's `sandbox` loses `allow-same-origin` | The comment says it is load-bearing; the drawer check asserts the attribute | V5 |
| `jose@5` override breaks Better Auth | Removed in phase 1 | V7 (`npm ls jose`) |
| Better Auth patch releases change security code | Exact pin; V5 and V7 re-run on every bump | V5, V7 |

## Verification

"CI" means `ci.yml` runs it on every push from the phase named. "Manual" means walked and recorded in the PR or the release. From phase 3, every check that drives the board, writes through any endpoint (the public API included) or signs in first completes `/setup` — except the pre-setup assertions of V7-3 and V7-5 — with a harness-set `SETUP_CODE` (an unclaimed board redirects to `/setup`, which refuses framing). All static checks scan the tracked app-code scope (`app lib components hooks queries trpc db providers proxy.ts instrumentation.ts next.config.ts`), never `scripts/`, `ci/` or `docs/` (except V6, which also scans `scripts/`), and any pattern that would match its own source lives in `ci.yml`. Harness scripts that import guarded modules run with `tsx --conditions=react-server`. The harness is committed:
`scripts/ci-gates.ts`, `scripts/drawer-auth-check.ts` (Playwright),
`scripts/e2e/*.ts`, `scripts/mock-llm.ts`, `scripts/fixtures/search-corpus.json`,
the compose files under `ci/` (PgBouncer, HTTPS board, Mailpit, DNS log, private CA, mock OpenRouter — every service image pinned by digest), `ci/oidc-mock.ts` and `ci/helmet-host.ts`, and the migration fixtures under `scripts/e2e/fixtures/`.

0. **Retirement** (*manual*). Phase −1: a push produces no Vercel status.
   Phase 9: `npm view feedbackland-react@2 deprecated` is set; the parking page
   serves and posts `feedbackland:ready`; `api.feedbackland.com` answers 410
   with CORS.
1. **Static and boot (CI, phase 0 / 1 / 3).** On a clean checkout with **no
   environment**: `npm ci`, the widget build, `npm run typecheck`,
   `next build`, `scripts/ci-gates.ts`. From phase 1, with a
   `pgvector/pgvector:pg18` service: start the built server, wait for
   `/api/health`, assert that `kysely_migration` lists every registered
   migration and that `format_type` of `feedback.embedding` is `vector(768)`,
   regenerate `db/schema.ts` and `git diff --exit-code`; `npm run dev` with `.env.local` against `compose.dev.yml` answers `/api/health` 200 (the same `register()` boot); a container pointed at
   an unreachable database exits 1 within 100 s, naming it; after a page, a route handler and a tRPC call, `pg_stat_activity` shows at most `DATABASE_POOL_MAX` app connections; with `AI_EMBEDDING_DIMENSIONS=3072` the column is `halfvec(3072)` with an HNSW index, and `4096` fails boot naming the 1–4,000 rule. From phase 3:
   complete `/setup` over HTTP with a harness-set `SETUP_CODE` (its
   `signUpEmail` fails on schema drift), sign up a second user over HTTP, and
   diff `compileMigrations()` against an empty database with the committed
   Better Auth block.
2. **The primary flow (CI from phase 6; *manual* before, from phase 3,
   skipping search and, before phase 5, images).** `compose.yml` with no `.env` and no `APP_URL` (in CI, with `ci/compose.mock-llm.yml` and `OPENROUTER_API_KEY` from the job environment; V11 runs the same script without it): setup code from the banner → `/setup` → sign in at
   `http://localhost:3000` → post (with an image) → comment → upvote → edit the
   post and the comment → search → admin → the widget on a page served from
   `http://127.0.0.1:4173` (a different site from `localhost`) embeds and
   submits. Once more from `http://<LAN IP>:3000` (not a secure context), where
   copy actions use their fallback.
3. **Lifecycle (CI, phase 1 / 7).** Phase 1: with the harness holding `pg_advisory_xact_lock(4702111234474983745)` in an open transaction and `ALTER ROLE postgres SET statement_timeout = '1s'` in force, two boots both log "Waiting for another instance…" within 5 s; on release, exactly one applies `0001_init` and the other logs that there is nothing to migrate; an anonymous post created through the public
   API survives `down` / `up -d`; a CI-built image `feedbackland:fail`, run against a database at `0001`, with a deliberately failing migration (`scripts/e2e/fixtures/9998_fail.ts`, added the same way) exits naming the migration **and its SQL error**, leaves
   `kysely_migration` unchanged, never serves, and the next boot is not
   blocked. Phase 7: upgrade from `:1.0.0-rc.1` to a CI-built, never-published image `feedbackland:v3-probe` whose extra migration `9999_v3_probe` (an empty table) lives in `scripts/e2e/fixtures/9999_v3_probe.ts` and is copied into `db/migrations/` and registered only in that CI job — it applies and data survives; roll back to `:1.0.0-rc.1`
   — it starts, logging "database is newer than this image".
4. **Backup and restore (CI, phase 5 / 7; `scripts/e2e/v4-backup.ts`).** Phase 5: `pg_dump -Fc -Z 6` (run from a `pgvector/pgvector:pg18` container) of a board with an uploaded image, restored with §8's procedure into a fresh database — once where pgvector lives in the same schema, once where the target pre-installed it in `extensions` (relocated first); row counts, every image's sha256 and a sign-in with the original password all match; a back-dated unreferenced image is swept while a referenced one and the logo survive. Phase 7, with `BACKUP_KEEP=1`: the backup profile writes a `-Fc` dump (mode 0600), a stopped database leaves the previous dumps intact, and the restore also brings back search.
5. **Drawer auth (CI; the merge blocker for phases 2, 3, 4, 6 and 8).**
   `scripts/drawer-auth-check.ts` drives Chromium, Firefox and WebKit, framing
   the board at `http://localhost:3000` from a host page at
   `http://127.0.0.1:4173`, through the widget (from phase 8, the **packed**
   widget), and asserts the literal `sandbox` attribute.
   - *Navigation (phase 2):* open a post inside the drawer, force a frame reload; Playwright adds `x-nextjs-deployment-id: mismatch` to the next RSC response and, separately, answers one RSC request with 502; the drawer still renders.
   - *Email and password (phase 3):* sign up; a protected call succeeds;
     reload the host page and stay signed in (Chromium, Firefox); clear the
     token and the session is gone (no hidden cookie); sign out from the drawer
     header; sign in again; upvote and comment; `localStorage` forced to throw — sign-in works from memory. *Same-site (phase 3):* a host page at `http://localhost:4173` framing the board at `http://localhost:3000`, while the browser holds a first-party admin session on the board — the drawer starts signed out, and after a drawer sign-in and sign-out the board session is still first-party admin.
   - *Social (phase 4):* against the HTTPS board (`ci/compose.https.yml`,
     `https://localhost:8443`, `APP_URL` set, Playwright ignoring the internal
     CA) with `OIDC_ISSUER` at the mock: a popup sign-in completes through the handoff (the mock publishes `end_session_endpoint`: the OIDC user then signs out from the drawer header, the frame does not navigate, and `/sign-out` returns no `url`), including with the mock **enforcing** `Cross-Origin-Opener-Policy:
     same-origin` and with a host page from `ci/helmet-host.ts` using Helmet's defaults (so `Cross-Origin-Opener-Policy: same-origin`), except that `contentSecurityPolicy.directives` adds `frame-src <board>` and `connect-src 'self' <board>` and sets `upgradeInsecureRequests: null` — the host-page CSP the widget README prescribes;
     `account_not_linked`, an IdP `access_denied` and a pre-state `state_mismatch` reach the drawer; a repeat start with the same ticket after Back is accepted; a drawer popup sign-in leaves the board's first-party session intact; a first-party popup sign-in on the standalone board completes; an IdP started after the app leaves the OIDC button hidden and the banner reporting that OIDC discovery failed.
   - *Discovery retry (phase 6):* the same start order shows "discovery failed" in the System panel, and its retry enables the button without a restart.
   - *Manual, per release:* real Google and Microsoft in Chrome and Safari on
     macOS and iOS (where the session is expected to end with the browser).
6. **No org remains (CI, phase 1 / 9).** `git grep -n -i -P` (tracked files
   only; the pattern lives in `ci.yml`, not under a scanned path) for
   `(?<![\w./-])orgs?\b|orgid|orgname|orgurl|orgsubdomain|isclaimed|user_org|userorg|platform-?urls?|platformid|subdomain|maindomain|claimorg|createorg|getorg|updateorg|useorg|globalorgstate|organi[sz]ation|(?<!microsoft_)tenant(?!_?id)|isselfhosted|self_hosted|vercel|feedbackland\.com`
   over `app lib components hooks queries trpc db providers scripts proxy.ts next.config.ts instrumentation.ts` from phase 1 (`platformid` only from phase 8, when the 3.x widget drops the prop; until then the 2.x widget in the workspace requires it, §1 *Surfaces*), and additionally over
   `feedbackland-react` (excluding its `README.md`) from phase 9; plus the same terms against the file names from `git ls-files ':!docs' ':!feedbackland-react'` from phase 1, and from `git ls-files ':!docs'` from phase 9 (the widget's `resolve-platform-urls.ts` is renamed in phase 8). Separately
   (`scripts/e2e/v6-urls.ts`): the invite link, the widget snippet and the API example (from phase 3, when an admin exists) and a copied Ask-AI citation (from phase 6) are absolute and use the app URL.
7. **Security (CI).** Each item is blocking from the phase shown.

   | Phase | Assertion |
   |---|---|
   | 0 | after decoy `.env` and `.env.production` files are written into the build context, the image contains no `.env*` anywhere, and no `sharp` or `@img` anywhere in its filesystem |
   | 1 | `/api/user/upsert-user` 404s and nothing references it; every module in §2's list starts with `import "server-only"` and no bare string remains; no `process.env` outside `lib/config.ts`, `instrumentation.ts` and the shrinking legacy allow-list (Environment reference); no `selectAll` on `settings`; nothing outside `lib/boot/`, `db/migrations/` and `db/schema.ts` names `instance_secret`; the setup code appears in no HTML, tRPC response or log line when chosen, and the auth secret in no HTML, `/api/*` response or log line; `/api/feedback/create` takes `{ orgId, description }` → 201 `{ id }`, `{}` → 400 with CORS headers, and `OPTIONS` → `Allow-Methods: POST, OPTIONS`, `Max-Age: 86400`; `npm ls jose` resolves 6.x for Better Auth |
   | 2 | (routes that do not exist yet answer 404, still with their `headers()` values) full header values on `/`, `/?embed=drawer`, `/<uuid>?embed=drawer`, `/?embed=x&embed=drawer`, `/admin`, `/setup`, `/recover`, `/reset-password`, `/auth/popup` and `/api/images/<id>` match §2; `/?embed=x&embed=drawer` renders no account menu; no `navigator.clipboard` outside `lib/copy-text.ts`; `GET /robots.txt` → 404; a post containing `<span data-type="status" data-label="planned fixed inset-0">` renders the label as plain text with no class |
   | 3 | `/setup`: rejected without the code, rate-limited, refused when the limiter's table is unavailable (fails closed), two concurrent correct submissions (with fresh `X-Forwarded-For` values after the rate-limit assertion) create one admin; a sign-up with `role: "admin"` is stored as `user`, and `/update-user { role }` answers 400; before setup, a post, `POST /api/feedback/create` and `/api/chat` answer 403 `SETUP_REQUIRED`; `/setup` completes with `DATABASE_POOL_MAX=2`; a rolling refresh moves `auth_session.expiresAt` forward; the code stops working once claimed, a pre-existing identity is not adopted, and before setup `POST /api/auth/sign-up/email` answers 403. A drawer token sent as `Authorization` **and** as a forged `Cookie` cannot call an admin procedure or `/api/chat`; `/update-session { scope }` is refused; an admin session older than 7 days is refused; a raw `auth_session.token` is rejected as bearer and as cookie; first-party sign-in, `/update-user` and refresh responses carry no `set-auth-token`; a token captured before sign-out is rejected after; `/change-password` with `revokeOtherSessions` from a drawer token yields an embedded session. Expired and used invites are refused, as is a non-matching email. Repeated failed sign-ins rate-limit that client only — two clients behind a multi-hop `X-Forwarded-For` land in two buckets with `TRUSTED_PROXIES` set. No `firebase` import remains. A `multipart/form-data` POST to an input-less admin mutation with a valid admin cookie answers 415 and changes nothing; a JSON POST with `Sec-Fetch-Site: same-site` answers 403. The eleventh failed sign-in for one email within 15 minutes answers 429 from a fresh `X-Forwarded-For`. A sign-up or `/update-user` carrying `image` stores null, and a 500-character `name` is cut to 100. No response carries `set-auth-token` in `Access-Control-Expose-Headers` except an embedded one; a drawer token for an admin identity cannot call an admin procedure |
   | 4 | `/recover`: 404 without `RECOVERY_CODE`; its code is compared in constant time and never logged; rate-limited, and refused while the limiter's table is renamed (fails closed); a mock-IdP profile carrying `role: admin` signs in as `user`; `createPasswordResetLink` for another admin answers FORBIDDEN; resets an admin's password and revokes their other sessions; refuses a non-admin email. A second sign-in method on an existing email does not link. Handoff: `GET /auth/popup` with `Sec-Fetch-Site: cross-site`, and with `none`, is 400; `GET /auth/popup/done?ticket=<foreign ticket>` in a signed-in browser binds nothing; a claim with a wrong secret, a second claim and a claim after expiry fail. With a Mailpit service: SMTP set and `APP_URL` set → exactly one email whose link resets the password, and a request with `X-Forwarded-Host: evil.example` still yields a link on `APP_URL`'s host; `APP_URL` unset → nothing is sent and the form shows the ask-an-admin copy. An admin-generated link, with and without `APP_URL`, opens `/reset-password` and resets the password. A returning provider user's `auth_account` row holds no tokens. A token claimed through the handoff has `scope = embedded`; sent as `Authorization` and as a forged `Cookie` for an admin identity, it cannot call an admin procedure or `/api/chat`. A post containing `<a href="/auth/popup?…">` and `<a href="<APP_URL>/auth/popup?…">` is stored and rendered without either link |
   | 5 | uploads: an SVG labelled `image/png` is refused; 50 MB bodies to `/api/images`, `/api/trpc`, `/api/feedback/create` and `/api/auth/sign-up/email` are refused before the body is read (resident memory grows by less than 32 MB); a pasted external `<img>` is stripped; a `data:` source or an unknown image id is refused with 400; `/api/images/<id>` carries `nosniff` and the sandbox CSP; uploads past `MAX_PENDING_IMAGE_BYTES` answer 507; before setup, `POST /api/images` answers 403 `SETUP_REQUIRED`. No `supabase` import; zero `NEXT_PUBLIC_` |
   | 6 | a 50 MB body to `/api/chat` is refused the same way; the legacy `process.env` allow-list is empty; no `generateText`/`streamText`/`embed` call outside `lib/llm/`; no `openrouter` package import; no `console.*` in `lib/llm/`; nothing outside `lib/llm/settings-store.ts`, `db/migrations/` and the generated `db/schema.ts` names `ai_settings`; no AI procedure response contains a key beyond its last four characters; the only `createOpenAICompatible` call is in `lib/llm/client.ts`, with the base URL from `lib/llm/constants.ts` and `fetch` from `lib/llm/fetch.ts`; nothing in `lib/llm/` calls `fetch` except `fetch.ts`; no `openrouter.ai` literal outside `lib/llm/constants.ts` |
   | 7 | under `compose.tls.yml` (with `COMPOSE_FILE` in `.env`), `http://<host>:3000` is refused, including after `docker compose pull --ignore-pull-failures && docker compose up -d` (the local tag cannot be pulled; the command is run for its `COMPOSE_FILE` handling) |

8. **Semantic search on real topologies (CI, phase 1 / 6).** Phase 1:
   migrations converge on pgvector in `public` (the stock image), on pgvector
   pre-installed in `extensions`, and through PgBouncer in transaction mode —
   including a boot through PgBouncer right after a failed migration, which completes within 30 s. Phase 6, with embeddings from `scripts/mock-llm.ts` (deterministic: the same text always yields the same vector, so a post's own title finds it): a post is created and found by search in each topology;
   `EXPLAIN` of the SQL `vectorDistance()` compiles (under `tsx --conditions=react-server`, with the same `SET LOCAL`s and `enable_seqscan = off`) shows the HNSW index under `OPERATOR(<schema>.<=>)`; with 45 posts of identical text, "load more" pages past 40 results.
9. **One-click, without a terminal (*manual*, phase 7 / 9).** Phase 7, against
   `:1.0.0-rc.1` through the `render-rc` branch and an unpublished Railway
   template: deploy, choose a setup code in the form, open the HTTPS URL,
   complete setup, post, embed the widget on another site; confirm the resolved
   app URL in the System panel; record whether Railway treats `:1` as a moving tag or pins the digest it resolved; confirm Render delivers `true-client-ip` and
   overwrites a client-sent one; check the bill matches §8; record whether the
   blueprint offers free plans (SELFHOSTING states the result); add a custom
   domain and confirm sign-in fails until `APP_URL` is set, then works, and
   that snippets and callback URIs follow. Phase 9: the same smoke from the
   README buttons on `:1`, with an anonymous pull.
10. **Not Compose (CI and *manual*, phase 0 / 7).** CI:
    `docker run --hostname bogus -e PORT=8080 -e DATABASE_URL=<ci db> -p 8080:8080 feedbackland:ci`, then `curl -f http://127.0.0.1:8080/api/health`, and `docker exec <id> node -p process.env.HOSTNAME` prints `0.0.0.0` — Docker sets `HOSTNAME=bogus`, the image's `ENV` overrides it (§8); an explicit `-e HOSTNAME=bogus` is honoured and exits 1 naming `ENOTFOUND bogus` (phase 0); the container
    runs `read_only` with only the two `tmpfs` paths while every route type
    (board, post, admin, API, images, auth, streaming Ask-AI) is exercised; a
    private-CA Postgres with `sslmode=require` and with `sslmode=verify-full` +
    `DATABASE_SSL_CA`; `compose.external-db.yml` boots against that private-CA Postgres; `verify-full` to an IP host whose certificate names another host fails; `deploy/kubernetes.yaml` passes `kubeconform -strict`. *Manual:* Neon with `sslmode=verify-full`.
11. **Keyless (CI, phase 6).** Everything in V2 with no model; the admin sees
    the "AI off" pill, the Activity card and the explained Insights and Ask AI
    pages, while the board and the drawer show nothing about AI; AI surfaces
    absent **including inside the drawer**, and their endpoints answer
    `AI_NOT_CONFIGURED`; posting, editing and search work; "load more" under `ILIKE` on the board and the admin Activity tab returns all 45 matches of a seeded set, with no duplicate id; a search
    for "image" does not match every post with a picture; a popover submission
    works.
12. **Broken key (CI, phase 6, with `scripts/mock-llm.ts`).** 401, 402, 429,
    500 and a timeout each leave posts, comments and edits **accepted** and
    logged, never "inappropriate", and afterwards the System panel's
    unscreened count equals the items posted; the logs of the 401 case contain
    neither the post text nor any email address; a text-only model refusing an image still moderates the text. Each unscreened item has a `moderation_event` row with its id and mapped reason and appears under Activity's **Unscreened** filter; `lastCheck` and `health` hold no provider text. A backfill batch containing a row the mock refuses with 400, and an image-only comment, do not stall the backfill (the rest are indexed; the refused row is counted as can't-be-indexed); a 402 produces at most 5 embedding requests in 10 minutes. **Key-only:** the mock serves TLS as
    `openrouter.ai` (the container gets `--add-host openrouter.ai:<mock IP>`
    and `NODE_EXTRA_CA_CERTS` with the mock's CA) and only `OPENROUTER_API_KEY` is
    set — boot succeeds, `capabilities.embeddings` becomes true after the
    probe, the embedding request carries `dimensions: 768`, and Ask-AI's request body carries the part-level cache breakpoint; chat **and embedding** request bodies carry `provider.data_collection: "deny"` (and `zdr: true` with the strict switch); `llm_usage.costUsd` is filled from the mock's `usage.cost` for both; reading three pages of a semantic search makes one embedding request; the mock records model calls only at `/api/v1/chat/completions` and `/api/v1/embeddings`, with none of `HTTP-Referer`, `X-OpenRouter-Title`, `X-Title`, `X-OpenRouter-Categories` or `X-OpenRouter-App-Visibility`; each of the six model call paths is recorded there; a 429 and a 500 each produce exactly one request per call. A mock 403 `content_policy_violation` and a `content_filter` reply are each **refused**, not stored. *Manual, phase 6 and
    per release:* against real OpenRouter, 768 values come back from the
    default embedding model, and the search corpus finds every related pair and
    excludes every unrelated one at the default `AI_SEARCH_MAX_DISTANCE`, and on a fresh account with credit the default models pass the live check with `data_collection: "deny"` on.
13. **Search index (CI, phase 6, with `scripts/mock-llm.ts`).** **Mismatch:**
    with the mock returning 384 values for a 768 column, the board starts,
    posting works, search falls back to `ILIKE`, and the probe's `AI:` log line and the System panel — in the same process — name both numbers. Changing
    `OPENROUTER_EMBEDDING_MODEL` to another 768-wide model and restarting stops
    semantic search with the rebuild message until **Rebuild search index**
    runs. **Unreachable:** with the mock held down until the harness has completed `/setup` and posted (at least 20 s after boot), the board starts, those posts are stored and recorded (`provider-error`), embeddings are *unverified*, and they turn verified at a later probe retry — within 3 minutes of the mock starting, with no restart.
14. **Single tenancy is structural (CI, phase 1).** `INSERT INTO settings (id)
    VALUES (2)` fails with `23514` (the `CHECK`); a second `id = 1` fails with
    `23505`; deleting the row on a database with a user (seeded with SQL, since phase 1 has no sign-up) makes the next boot fail
    rather than reopen `/setup`.
15. **Widget package (CI, phase 8).** `npm pack`: the tarball contains only
    `package.json`, `LICENSE`, `README.md` and `dist/`; the `.d.ts` makes `url`
    required and has no `platformId`; the README contains neither `platformId`
    nor `feedbackland.com` outside "Migrating from 2.x"; the drawer and the
    popover both work cross-site from the packed tarball; a 4xx, and a 5xx with the database stopped, from `/api/feedback/create` carry CORS headers; an `http:` URL on an `https:`
    host page shows the configuration error.
16. **Build hygiene (CI, phase 0 / 6).** `next build` succeeds with no
    environment at all, and `prerender-manifest.json`'s `routes` contain none of `/`, `/admin`, `/setup`, `/recover`, `/reset-password` or any path under `/admin` or `/setup` (Next's `/_not-found`, `/_global-error` and static icon files may appear); the Dockerfile builds with `RUN --network=none npm
    run build` (no Google Fonts), and CI asserts `NEXT_TELEMETRY_DISABLED=1` is
    set in the build stage — blocking egress alone proves nothing about
    telemetry, whose failures are silent. From phase 6: the app sits only on an
    `internal: true` network with `/etc/resolv.conf` bind-mounted to point at
    a static-IP dnsmasq that logs queries and answers `db`; a Caddy container
    on both networks publishes the app to the harness. The app starts and
    serves — including an admin opening Activity and Settings → AI with no key
    configured — and the log shows `db` and nothing else. (Docker's embedded
    resolver would answer container names itself, so the database host would
    never reach a logger.)
17. **App stores (*manual*, phase 10), per store.** It installs from its own
    artefact, the setup code comes from the store's documented source, `/setup`
    completes, and a post survives a restart.

18. **AI onboarding (CI, phase 6, with `scripts/mock-llm.ts`).** The mock is
    served as `openrouter.ai`, as in V12 (`ci/compose.mock-llm.yml`); the CI legs run in Chromium, whose `--host-resolver-rules` maps `openrouter.ai` for the browser. Time is advanced by rewriting stored timestamps with the app stopped and then restarting it — `health.<capability>.failingSince` (15 minutes), `admin_notice.hiddenUntil` (14 days), `apiKeySetAt`/`creditWaitUntil` (the 7-day wait); the UTC rollover is proven by seeding `ai:instance:day:<yesterday>` at the cap and asserting that calls are admitted under today's key. Only the 15-second and 5-minute credit polls wait in real time.
    - *Connect, redirect:* from a keyless board on the HTTPS board
      (`ci/compose.https.yml`), completing `/setup` lands on the AI step;
      **Connect OpenRouter** goes to the mock's `/auth` (Playwright maps `openrouter.ai` to the mock with `--host-resolver-rules` and trusts its CA) with an S256 challenge
      and a `callback_url` on the board, the mock redirects back with
      `?code=`, and with no further click the page exchanges the code by POST,
      removes it from the address bar and shows "AI is on". Without a restart,
      `capabilities.chat` and `capabilities.embeddings` are true at once in
      the saving process and within 5 seconds plus one probe in a second
      replica; a new post is moderated and titled; the backfill indexes
      existing posts and comments with visible progress. A `GET` of the page
      with a `?code=` and no pending flow exchanges nothing; a `finish` from another admin's session, with no cookie, or at a return path whose nonce does not match, is refused — including for a challenge-less code; on the HTTPS board reached as `https://board.test:8443` (`APP_URL` set to it; `--host-resolver-rules` maps `board.test`), the public-app note shows only while `allowIndexing` is on, and a board with it off uses headless mode; the verifier
      cookie holds ciphertext.
    - *Connect, headless:* on `http://<LAN IP>:3000` (a board without `APP_URL`, since a LAN-IP sign-in against `APP_URL=https://localhost:8443` is refused as `INVALID_ORIGIN`, §3) the button opens `/auth` in a new tab with no `callback_url`, the first tab shows the focused code field, and pasting the mock's code turns AI on. After **Turn off AI** with a key stored, the page's **Turn on AI** re-enables it without calling `/auth`.
    - *The credit step:* with the mock reporting `is_free_tier: true` and
      answering chat with 402 `openrouter_credits`, the page shows the credit
      step and the pill "AI: add credit"; posts meanwhile take the path without AI, and the pill never turns red; when the mock flips, AI turns on by itself within 15 seconds with the page open, and with the page closed within one 5-minute housekeeping tick; no more than 4 checks a minute were sent. Pressing Back and **Authorize** again after a finished flow exchanges nothing and says the connection timed out.
    - *Paste:* pasting an `sk-or-v1-` key checks it and turns AI on with no further click, and **Undo** turns it off again; OpenAI-, Anthropic- and Google-shaped keys each get their
      named answer, and the mock receives no request for them.
    - *Verdicts:* each mock error mode produces its mapped message (invalid,
      management and expired keys, 402 by `limit_source`, unknown model,
      data-policy mismatch, 429, timeout, unreachable, wrong embedding length
      with the rebuild offer); no provider text reaches the browser,
      `lastCheck` or `health`. **Test again** works while AI is paused;
      saving only the daily limit makes no model call; a save carrying a stale
      `updatedAt` is refused.
    - *The key:* no procedure returns more than its last four characters;
      `ai_settings.apiKey` is `v1.`-format ciphertext that decrypts with the
      auth secret, and a ciphertext with another column's associated data fails
      to decrypt; after the auth secret changes, the page reports an unreadable
      key and the pill is red. A mock answer of 302 is refused and not
      followed. **Remove key** clears it and shows the provider-side reminder;
      the key stops being sent at once in the saving process and within 5
      seconds in a second replica.
    - *The budget,* with the daily limit set to 10 on the AI page: after 8
      calls, titles, indexing and search embeddings stop (`capabilities.chat`
      false, search on `ILIKE`) while calls 9 and 10 go to moderation; refused
      feature calls do not consume moderation's share; the budget survives a
      housekeeping sweep; at the limit an anonymous board post and a `POST
      /api/feedback/create` answer 429 `{ code: "DAILY_LIMIT", resetsAt }`,
      while a signed-in comment is stored with a `daily-limit`
      `moderation_event` row and appears under **Unscreened**; the pill says
      "AI paused"; raising the limit restores AI within 5 seconds; a budget row seeded for yesterday at the cap does not refuse today's calls.
    - *The index:* **Rebuild the index at 1,536** (the mock returning 1,536)
      alters the column and the next request asks for 1,536; an embedding
      computed under the old generation and written after the rebuild is
      dropped.
    - *Telling the admin:* every nudge's button starts the state's one next step (Connect OpenRouter; Add credit while waiting; Turn on AI when a key is stored); one
      mock failure changes nothing a visitor sees; 15 minutes of failures turn
      the pill red, hide improve-draft and show the broken card, naming when it
      started, the reason and how many items went unscreened; a success clears
      all three. **Not now** hides the off card for that admin only (a second
      admin still sees it); **Keep AI off** removes the card, the in-context
      notices and the pill's action for every admin, and is reversible.
    - *Environment:* with `OPENROUTER_MODEL` set the field is locked; with
      `OPENROUTER_API_KEY` set the page shows "Configured on the server", and
      **Turn off AI** still turns AI off. **Turn off AI** returns the board to
      the keyless behaviour at once in the saving process and within 5 seconds
      in a second replica.
    - *Manual, once per release:* the real Connect OpenRouter flow on an HTTPS
      install — with an existing account, and with a brand-new one through
      adding credit — recording whether `/auth` honours `limit` and whether a public `callback_url` lists the board among OpenRouter's public apps — and on `http://localhost:3000` (redirect, in Chromium, Firefox and WebKit) and a LAN IP (headless); **Confirm
      it's yours**; pasting a real key.

## Appendix A — Corrections that must not be reintroduced

Each of these appeared in an earlier revision, reads plausibly, and is wrong.

- "If `proxy.ts` doesn't run the drawer only flashes once" — the layout swaps
  after hydration (§2).
- "Constraining `/:postId` to a UUID removes the row-order hazard" — order
  still controls three rows sharing one header key (§2).
- "A full reload re-reads `embed` from the iframe `src`" — it re-requests the
  current URL (§2).
- "Anonymous posting gets an anonymous session" — it gets none (§3).
- "Cookies are impossible in the drawer at Chrome's defaults" — the conclusion
  holds for other reasons (§3).
- "`TRUST_PROXY` governs `X-Forwarded-Host/-Proto`" — Next fills and keeps
  them regardless; Better Auth needs `trustedProxyHeaders` (§3).
- "`ensureSession` after sign-in" / "an app-owned `user` table" — Better Auth
  owns `user` (§3).
- "Admin power can be keyed on whether a request carried a cookie or an
  `Authorization` header" — the bearer token is the cookie value; admin power
  is the session's `scope` (§3).
- "`/auth/popup/done` binds the ticket to the current session" — that is a
  session-stealing CSRF; binding happens inside the OAuth callback (§3).
- "The OIDC callback is `/api/auth/oauth2/callback/oidc`" — it is
  `/api/auth/callback/oidc` (§3).
- "A `session.create.before` hook caps admin sessions at 7 days" — the first
  refresh undoes it; the admin rule checks `createdAt` (§3).
- "`getMigrations(auth.options).runMigrations()` at boot with a placeholder
  secret" — the DDL is generated and committed; `getMigrations` needs no
  secret anyway (measured 2026-09-26).
- "A connect-provider screen with linking disabled" — Better Auth refuses
  explicit linking too (§3).
- "`createOpenAI({ baseURL })` speaks plain OpenAI-compatible HTTP" — it calls
  the Responses API and needs a key (§5).
- "`providerOptions.openrouter` carries Ask-AI's cache breakpoint through
  `openai-compatible`" — only request-level fields pass; the breakpoint is
  rewritten in `transformRequestBody` (§5).
- "`processImagesInHTML` moves to the server" — bodies are capped at 10,000
  characters; uploads happen on insert (§4).
- "The container entrypoint exports `BETTER_AUTH_SECRET` and scripts use it
  via `docker compose exec`" — exec'd processes never see it; there are no
  runtime scripts (§6).
- "Kysely can be pointed at a folder of `.sql` files" — they are skipped
  silently (§6).
- "Kysely's `Migrator` can run inside the boot transaction as is" — its
  session lock masks errors and outlives the transaction; boot uses a
  non-locking adapter (§6).
- "A module-level singleton set during boot is visible to requests" — each
  bundle layer has its own copy; shared state lives on `globalThis` (§6).
- "`register()` runs during `next build`" — Next skips it; the guard is
  belt-and-braces (§6).
- "An `ALTER ROLE … SET search_path` makes pgvector resolvable everywhere" —
  it does not survive restore, poolers or other roles; the operator is
  schema-qualified (§6).
- "PgBouncer rejects the `options` startup parameter" — supported since 1.20;
  irrelevant now that nothing depends on session state.
- "Refuse to boot on an embedding-dimension mismatch" — AI can never stop boot
  (§5).
- "A platform-injected `HOSTNAME` always wins" / "an entrypoint must fix it" —
  the image's `ENV` wins on Docker and Kubernetes (§8).
- "`isrFlushToDisk` is a top-level config key" — it is `experimental` (§8).
- "Omit optional dependencies to keep `sharp` out" — that breaks the build; the
  traced copy is deleted after it (§4).
- "The compose file is the one-click artefact for seven catalogues" — each
  store has its own format; wrappers are generated (§8).
- "Render costs ~$7 a month" / "$13" — $13.30 at 1 GB with `diskSizeGB` set;
  more without it (§8).
- "`render.yaml` pushes cannot reach an operator's instance by any route" —
  Blueprint sync applies them; the button uses a frozen branch (§8).
- "The daily AI limit can reuse `checkRateLimit`'s window" — the hourly sweep
  deletes the row, the window rolls instead of resetting at 00:00 UTC, and
  refused calls count (§5).
- "At the daily limit, AI pauses and posts continue unmoderated" — that is a
  ten-minute moderation bypass; anonymous posts are refused instead (§5).
- "`providerOptions.openrouter.provider` reaches embedding requests" — the
  embedding body is built from a fixed list; `lib/llm/fetch.ts` adds it (§5).
- "OpenRouter's `/auth` echoes a `state` value" — it defines none; the verifier is encrypted and bound to the admin, and a per-flow path nonce is the state (§5).
- "OpenRouter's cost is at `result.usage.raw.cost`" — it is at
  `steps[].usage.raw.cost` for chat and `responses[].body.usage.cost` for `embedMany`, and `response.body.usage.cost` for a single `embed` (§5).
- "There is no hosted service" — it is live until §0 retires it.
- "`orgName`/`orgUrl` are shown on the board" — they are rendered nowhere (§1).
- "Four places need an absolute URL" — seven (§1).
- "Sixteen bare `CREATE INDEX`" — sixteen in total, thirteen bare (§6).

## Appendix B — Evidence

The 2026-09-26 audit's scripts live in a session scratchpad and are not part
of the repository; each claim they settled is therefore re-proven by the
committed check named here.

| Claim | Re-proven by |
|---|---|
| Next standalone `request.url` uses the bind address; Better Auth 403s without `trustedProxyHeaders` | V2, V5 (email and password at `http://localhost:3000` with no `APP_URL`, phase 3) |
| Reset-link poisoning through `X-Forwarded-Host` | V7 (phase 4) |
| Better Auth rate-limit buckets under multi-hop `X-Forwarded-For` | V7 (phase 3) |
| Signed tokens; a drawer token replayed as a cookie; raw-token rejection; `set-auth-token` on first-party responses | V7 (phase 3) |
| The `/auth/popup/done` CSRF and its fix; the handoff under COOP | V7 (phase 4), V5 |
| Schema drift → `SchemaMismatchError`; validation checks presence only | V1 |
| Standalone output lacks `kysely`/`better-auth`/`pgvector`; boot inside the bundle works; three module copies per process; a thrown `register()` keeps serving 500s | V1, V12, V13 |
| Kysely: `.sql` skipped; `.error` not thrown; the session lock masking errors; the missing-migration check | V1, V3, V8 |
| pgvector: bare `<=>` fails outside `search_path`; qualified operator uses HNSW; paging stops at 40; HNSW limit 4,000; relocatable extension | V8, V4 |
| `pg` treats `sslmode=require` as `verify-full`; URL parameters override `ssl` | V10 |
| `@ai-sdk/openai` calls `/v1/responses`; `openai-compatible` does not; message-level `providerOptions` are dropped; `provider` is dropped from embedding bodies; redirects are followed | V12, V18 (redirect) |
| `streamText`'s default `onError` logs the prompt | V12 (log assertion) |
| The drawer loses `embed=drawer` and reloads into a refused frame; `?embed=x&embed=drawer` | V5, V7 |
| Compose override appends `ports`; `!reset` removes them; `COMPOSE_FILE` keeps the overlay | V7 (phase 7) |
| Postgres 18 refuses the `/var/lib/postgresql/data` mount | V3 (the bundled compose file boots and persists) |
| Browser storage partitioning and WebKit ephemerality | V5 (partitioning, in Chromium and Firefox) and the manual Safari/iOS pass (Playwright's Linux WebKit is not Safari) |
