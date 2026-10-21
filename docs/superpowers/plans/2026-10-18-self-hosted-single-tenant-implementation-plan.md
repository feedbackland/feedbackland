# Self-hosted single-tenant implementation PR sequence

**Date:** 2026-10-18. **Execution update (2026-10-21):** P01/P02 merged;
P02 review fixes, including the four follow-up findings, submitted as PR #13;
P03 retains those fixes and all 16 cumulative
phase-2 groups passed locally; independent review is next.
**Baseline:** `e159987a9d15d09c0b08c505cf644f34b8470f14`, branch
`single-tenant-self-hosting`. **Integration PR:** [#10](https://github.com/feedbackland/feedbackland/pull/10).

**Goal:** implement the [revision-4 design](../specs/2026-09-13-self-hosted-single-tenant-design.md)
through reviewable PRs whose delivered behavior and acceptance evidence are
explicit. The [resolution matrix](../reviews/2026-10-18-self-hosted-single-tenant-resolution.md)
defines F01–F29 and A01–A12; the design defines V0–V23. Those requirements remain
authoritative. This document supplies sequencing, interfaces, work boundaries
and completion criteria; it does not reopen the architecture.

The original planning pass wrote this document only. It performed no implementation,
service retirement, database migration, deployment, commit, push or PR update.
Execution updates and checkboxes below now record implementation progress. Existing synthetic
review experiments are evidence about particular contracts, not passing
application acceptance gates.

## Execution rules

1. P01–P12 target the integration branch, using `codex/` feature branches.
   Land each prerequisite there before starting its dependent PR. Keep #10
   unmerged into `main` until P00 and P12 pass, as required by the design.
   P13 onward target `main`. This is a clean reset into a **new disposable or
   new installation database**, never an in-place migration of hosted data.
2. Each PR includes its implementation, corresponding gate additions and
   necessary documentation changes. No follow-up may be required to make that
   PR's advertised exit state work. A gate becomes blocking when its owning
   behavior lands and stays blocking thereafter.
3. P01 and P02 are detailed here. Later cards are bounded work packages;
   expand their internal edit order when their prerequisites pass, using
   observed interfaces. Do not write another full architecture document.
4. P02 is one atomic integration PR. Its schema/types/tenancy/caller changes
   cannot safely be merged separately. Review it as ordered commits, with a
   final green tip. Intermediate commits are not installable releases.
5. Every container gate runs the image built from that PR's exact checkout,
   tagged `feedbackland:ci`. Record source SHA, artifact identity and image
   digest. A published release image is used only where a gate explicitly
   needs the previous release or a published-target smoke test.
6. Tests own their containers, networks, databases, ports and temporary files.
   Never inherit an operator's DATABASE_URL or source `.env*` into a test.
   Local harnesses with an existing `.env.local` use an isolated source copy;
   they never overwrite it. Preserve user services and volumes on port clashes.
   Docker teardown names only resources created by that run; no blanket prune
   or `down -v` against an operator installation.
7. Use `node:assert/strict`, `tsx` and the specified Playwright harnesses.
   No additional general-purpose test framework is needed. Import guarded
   server modules with `tsx --conditions=react-server`. Test real query modules
   and endpoints when available; do not substitute copied SQL experiments.
8. Store gate summaries, sanitized logs, fixture hashes and manual records in
   `artifacts/self-hosting/<run>/<check>/`. Inspect raw output for leakage
   **before** sanitizing artifacts. Generated setup-code log tests are an
   explicit exception: capture privately, assert the expected banner, redact
   before publication, and destroy the disposable install afterward. Never
   publish provider keys, environment inventories or customer exports.
9. A missing Docker engine, native runner, browser/IdP device or operator
   credential is a missing proof, not a pass. Fix the execution environment or
   retain the failing/pending gate; do not weaken the requirement.
10. Revert code PRs only while their data/schema contract permits it. Before
    rc.1, discard only the explicitly disposable development DB when `0001`
    changes. From rc.1, migrations are append-only and rollback follows the
    documented database compatibility/recovery-bundle rules.

## Sequence and dependencies

P00 is an operational gate, not an application-code PR. P01–P18 are work-package
IDs for PRs; P14 and P17 also require recorded release-owner operations. P18
is one small PR per store rather than one seven-store change.

| ID | Design phase | Dependency | PR outcome / closing gate |
|---|---|---|---|
| P00 | −1 | Named release owner | Hosted/deploy authority and secret separation recorded; V0 and V23 pre-flight |
| P01 | 0 | P00 local isolation | Secret-free standalone image, artifact identity and DB-only readiness; foundation gates |
| P02 | 1 | P01 | Single-tenant schema, boot, generated types and anonymous text board; phase-1 gates |
| P03 | 2 | P02 | Framing/navigation/metadata and resolved surface provider hierarchy; V5/V7/V19 phase-2 legs |
| P04 | 3 | P03 | Setup plus email/password and complete session-scoped authorization; auth gates |
| P05 | 4 | P04 | Social handoff, discovery convergence and operator recovery; V5/V19/V22 |
| P06 | 5 | P05 | Bounded image upload/storage/reference lifecycle and attachment restore; V4/V20 |
| P07 | 6a | P06 | AI settings identity, transport, admission, accounting and safe errors |
| P08 | 6a | P07 | Moderation/title/rewrite with current coverage and keyless behavior |
| P09 | 6a | P08 | Index epochs, leases/backfill and durable search sessions |
| P10 | 6a | P09 | Singleton fenced insight jobs and complete request reservations |
| P11 | 6b | P10 | Connect/paste/credit onboarding, System page and mounted-client AI status |
| P12 | 6 complete | P11 + P00 complete | Full integrated regression/manual evidence; integration merge only when green and authorized |
| P13 | 7 machinery | P12 merged to main | Operations, full recovery, native release artifacts and target definitions |
| P14 | 7 rc/lifecycle | P13 + public rc.1 | Real previous-artifact upgrade/rollback gates |
| P15 | 7 target validation | P14 | Actual Render/Railway deployment, cutover and cost records |
| P16 | 8 | P15 | Packed widget v3 and provenance publication workflow; V15/V5 |
| P17 | 9 | P16 + retirement dates | Stable release, target contracts and hosted retirement evidence |
| P18 | 10 | P17 | Store-specific wrappers and recorded installation/persistence tests |

The implementation path is P01 → … → P12, after local isolation. P00's external
owner work can proceed alongside P01–P11, but must finish before the first
merge to main at P12. The production release path continues through P17.
App-store work does not block P17. Ordering a merge/publication here does not
itself authorize that external action.

## P00 — Operational pre-flight

**Owner:** release maintainer; enter an actual primary and backup person in
`deploy/retirement/RECORD.md`. Creating a placeholder record does not pass it.
These are separately authorized external operations, not actions performed by
writing this plan.

- [ ] **Before P01 executes locally:** establish an isolated implementation
      checkout/test environment with no hosted dotenv input and owned disposable
      databases. Operator credential files remain privately protected. This local
      step permits feature-branch implementation; the external checklist below
      is a gate for merging to main, not a prerequisite for writing code.
- [ ] Record hosted integration disconnection while retaining the serving
      deployment; a branch push must no longer create a Vercel status.
- [ ] Record npm account email/2FA remediation and domain auto-renew, payment,
      backup contact, annual parking check and succession responsibilities.
- [ ] Record signup freeze, notice date, precise shutdown/export dates at
      least thirty calendar days after notice, and private export handling.
- [ ] Move hosted-era `.env` credentials out of the implementation checkout
      into operator-controlled storage; inspect other dotenv variants privately.
      No build or local Compose boot may inherit the hosted DATABASE_URL.
- [ ] Record ownership/evidence without copying credentials or exports into git.

**Exit:** V0 pre-flight and V23's owner/date/evidence requirements pass. The
external project/credentials are retained until P17's specified retirement
steps; disconnecting Git deploys is not permission to delete the live service.

## P01 — Foundations (detailed)

**PR title:** `build: add standalone container and database readiness`.
**Branch:** `codex/self-hosting-foundations`; base is the integration branch.
**Entry:** P00 local isolation recorded; Node 24 toolchain; a working Linux Docker/BuildKit
execution environment. The review environment lacked a Linux Docker daemon;
its availability must be established rather than assumed from CLI presence.

**Delivered state:** a clean checkout builds without app secrets or a database;
the container runs as a non-root, read-only standalone server; its health route
reports only database readiness. The legacy application is still transitional.
P01 does not claim a migrated board, setup, new authentication or keyless egress.

### Files and contracts

| Area | Create/change | Contract |
|---|---|---|
| Build | `Dockerfile`, `.dockerignore`, `next.config.ts`, `app/layout.tsx` | Standalone, unoptimized images, no build-time font download; no dotenv or sharp/@img in final image |
| Identity | `scripts/build-identity.mjs`, generated `lib/build-identity.json`, `.gitignore` | Commit/tree hash + architecture + artifact id; generated before typecheck/build, embedded in output, not operator configuration |
| Packaging | `package.json`, `package-lock.json`, `compose.yml`, `compose.dev.yml` | Node 24, preserve optional build dependencies/.npmrc; Compose runtime constants and isolated DB volume |
| Readiness | `app/api/health/route.ts`, `db/db.ts` | `200 {status:'ok',version}` or `503 {status:'down',version}`; SELECT 1 deadline two seconds; no schema/AI/auth call |
| Legacy import boundary | `lib/firebase/admin.ts`, `lib/firebase/client.ts`, `lib/supabase.ts` | Lazy delegates behind existing export names; zero SDK initialization at import; preserve receiver binding when actually used |
| CI | `.github/workflows/ci.yml`, `scripts/verify.ts`, `scripts/ci-gates.ts`, `scripts/e2e/run.ts`, `scripts/e2e/v0-foundations.ts` | Same local/CI phase entrypoint, exact-image verification, nonzero on any failed check |
| Docs | `SELFHOSTING.md` quick-start Compose block | Download committed Compose instead of the invalid pg18 data mount; explain development-image override until stable tags exist |

### Ordered implementation commits

1. **Capture the baseline and introduce the gate entrypoint.** Record installed
   versions and existing build/typecheck output on the clean baseline. Do not
   inherit the older plans' lint claims; inspect the actual current command.
   Any pre-existing blocking diagnostic gets an identified minimal prerequisite
   fix in this PR, without hiding it behind broad exclusions.
   Add `verify` as `tsx scripts/verify.ts`; add the dev-only `tsx` dependency.
   The CLI is `npm run verify -- --phase 0 --image feedbackland:ci --artifacts
   artifacts/self-hosting`. The runner executes registered current-phase
   static/runtime legs and all previously applicable legs; it never silently
   skips an absent implementation. It may record future phases as not yet due.
2. **Make imports safe before adding the Docker build.** Move Firebase
   Admin/browser and Supabase initialization into memoized factories behind the
   existing exported delegates. No factory runs from module evaluation. Forward
   method calls with their real SDK receiver; do not memoize an initialization
   rejection as a successful instance. Import-only tests use no credentials;
   factory/delegation tests verify first-use initialization and correct binding.
   Preserve `firebaseConfig.ts` in the temporary build allow-list until P04
   deletes its final importer. No hosted endpoint is exercised by these tests.
3. **Remove build-time network use.** Delete unused Google font imports and
   associated root classes, configure standalone/unoptimized output and
   `experimental.isrFlushToDisk`. Build the widget workspace before Next because
   the app resolves its `dist/` output. Keep native optional dependencies during
   npm ci; remove traced sharp/@img only after the Next build.
4. **Introduce artifact identity.** Generate the identity file before clean
   typechecking and every image build; CI passes its tested SHA through the
   build-only SOURCE_COMMIT argument. Local builds use the documented tree-hash
   fallback. Each actual build uses a fresh random nonce, even for identical
   source. Keep the full artifact hash as `generateBuildId` and use its generated
   32-character prefix as `deploymentId` to satisfy Vercel. Verification compares
   the image's source identity with the checkout, then checks its own bundled IDs;
   independent host and Docker builds must not share an artifact ID. Do not
   create an installation-secret claim for an image's Server Action key.
5. **Implement bounded DB readiness.** Add the pg pool error listener without
   logging URLs/credentials. Health uses no user table and works against an
   empty DB. Bound the response deadline and actual probe concurrency; a timed-out
   connection/query must not leave unlimited queued probes. Suppress unhandled
   rejection if the underlying attempt settles after the HTTP deadline. A
   stopped/restarted DB changes readiness without crashing the Node process.
6. **Build the image.** Use the design's Node 24 slim multi-stage layout,
   pinned multi-architecture base digest, root-owned immutable files, USER node,
   two tmpfs locations, telemetry off and direct `node server.js`. Build with
   no network after dependency installation. Re-include the identity script in
   the Docker allow-list; exclude `.env*`, node_modules and local build output
   last. Create `public/` explicitly when required.
7. **Add Compose and development DB.** Use the pg18 parent volume mount and TCP
   healthcheck, no published DB port in production, optional env_file, and exact
   PORT/HOSTNAME/NODE_ENV/telemetry/keepalive constants. No backup profile yet.
   CI uses FEEDBACKLAND_IMAGE=feedbackland:ci, not nonexistent `:1`. Development
   DB has its own volume and CI job; never share the production volume.
8. **Wire CI and record the real image results.** Build from the PR checkout,
   run the tests below and upload sanitized evidence only after checks. Keep
   runtime secrets out of build args. Do not publish an edge/stable image here.

### Required verification and completion

The commands below are **implementation-time commands**, not operations run by
this planning pass. The harness supplies disposable runtime configuration.

```text
npm ci
npm run build -w feedbackland-react
npm run typecheck
npm run build
docker build --tag feedbackland:ci .
npm run verify -- --phase 0 --image feedbackland:ci --artifacts artifacts/self-hosting
```

The workflow passes SOURCE_COMMIT when building in CI. The Dockerfile itself
enforces the no-network build stage; success of an ordinary host build alone
does not satisfy that check.

| Check | Required observation | Design gate |
|---|---|---|
| Clean build | No DATABASE_URL/auth/AI/mail credentials; widget then Next build succeeds; no dynamic-board prerender DB dependency | V1 static; V16 build |
| Image inspection | No decoy dotenv, sharp/@img or app runtime scripts; non-root; server starts directly; embedded identity matches artifact | V7 phase 0; V23 identity |
| Empty DB readiness | Empty bundled DB → 200; stopped DB → 503 within deadline; restored DB → 200; no Node crash/unhandled rejection | V1 foundation health |
| Read-only filesystem | Only specified tmpfs writes; no npm-dependent startup or font fetch | V10 foundation leg |
| Direct-image bindings | PORT=8080 works; Docker hostname does not defeat image bind address; explicit invalid HOSTNAME fails visibly | V10 PORT/HOSTNAME |
| Compose contamination | Stale PORT/HOSTNAME/NODE_ENV values in test env_file cannot change the fixed container contract | V23 Compose |
| Import boundary | Legacy modules import without SDK initialization; first-use delegates preserve call binding | V1 secret-free build prerequisite |

- [ ] All rows pass against the exact image and clean checkout.
- [ ] Test-owned resources are removed; no application/hosted DB was touched.
- [ ] README/SELFHOSTING do not describe P01 as the finished self-hosted product.

**Rollback:** revert this PR on the integration branch; P01 has not migrated an
application schema. Retain any unrelated host volumes. **Next:** P02.

## P02 — Single tenancy, schema and boot (detailed)

**PR title:** `refactor: establish single-tenant schema and transactional boot`.
**Branch:** `codex/single-tenant-boot`; base is integration after P01.
**Entry:** P01 green; a disposable empty PG18 database and isolated PG15 and
PgBouncer test services. No attempt to preserve hosted data or credentials.

**Delivered state:** boot migrates and seeds exactly once, the public board
runs at `/`, anonymous **text-only** posting works, metadata/settings resolve
from the singleton and restarts preserve data. Sign-in/admin are disabled until
P04; uploads until P06; AI and effective keys until P07/P08. Search reaches its
new exact/semantic implementation in P09. These are explicit pre-release states.

### Files and interfaces

| Owner/module | Interface / responsibility |
|---|---|
| `lib/config.ts` | Parse environment only through this module; DB options can be requested at boot, resolved auth secret only after seed; effective AI always off in this phase; neutralize the exact Better Auth environment list |
| `lib/log.ts` | Shared structured server logger; redact secrets/URLs/PEM, retain safe stage/SQLSTATE diagnostics and never log neutralized environment values |
| `lib/runtime-state.ts` | One `globalThis` state shared across instrumentation/RSC/handlers; boot promise, pools, setup latch, observed vector metadata and public status hints |
| `db/db.ts` | Lazy app-pool/Kysely access and reserved maintenance pool; app max = DATABASE_POOL_MAX−1, maintenance max 1; no config validation/DB connection triggered merely by import |
| `db/locks.ts` | Named exact bigint/literal keys from the design; never lossy Number constants; document lock order and scope |
| `lib/boot/register.ts`, `lib/boot/index.ts` and collaborators | Bounded DB wait, outer boot transaction, non-locking Kysely adapter, migration result inspection, seed/secrets/code, banner, sweeps; fatal boot exits nonzero |
| `lib/auth/options.ts`, `scripts/print-auth-ddl.ts` | Pure dependency-injected options for better-auth 1.7.6; generated DDL emitted against a separate empty DB; no runtime Better Auth migrator |
| `db/migrations/index.ts`, `0001_init.ts`, `db/schema.ts` | Static migration registry, complete revision-4 schema, generated types; no org tables/columns/types |
| `lib/llm/settings-store.ts` | Minimal `ensureAiSettingsRow(trx)` needed by boot; owns AI-table access from its first use; transport/jobs arrive in P07–P11 |
| `db/vector.ts` | Schema-qualified type/operator metadata and `vectorDistance`; no model call |
| `lib/settings.ts`, `providers/settings.tsx`, `hooks/use-settings.ts`, `app/api/settings/route.ts` | Explicit PublicSettings fields, SSR and visible polling with bounded staleness, no secret/session derived from public GET cookies |
| `queries/get-settings.ts`, `queries/update-settings.ts`, `trpc/update-settings.ts`, `hooks/use-update-settings.ts` | Explicit selects and SQL revision CAS; update route remains unauthorized until P04 supplies admin sessions |
| `lib/app-url.ts`, `lib/board-href.ts`, `lib/client-ip.ts`, rate-limit modules | One URL authority, board-relative navigation, shared IP policy and specified limits; fail-closed paths remain explicit |
| `app/(board)/**`, `lib/trpc.ts`, queries/procedures/hooks/components | Complete tenancy/type fallout; null unauthenticated context; public API response/CORS contract |
| `lib/housekeeping.ts` | Awaited batched sweeps only, no provider calls; image-specific mutations stay inactive until P06 |
| `ci/compose.{pgbouncer,private-ca,pg15}.yml`, `scripts/e2e/fixtures/9998_fail.ts`, `ci/fixtures/` | Disposable topology/TLS/support-floor services, deliberate migration failure and literal legacy-input fixtures; pinned service image digests |
| `scripts/e2e/{v1-boot,v3-lifecycle,v7-security,v8-search,v14-tenancy,v19-auth-invariants,v21-state-transitions,v22-recovery}.ts` | Only the phase-1 portions; real migrated DB and actual query modules |

The complete design schema is the checklist, including settings/secrets,
Better Auth tables, content/revisions/current moderation coverage, image refs,
reports/invites/events, fenced leases, AI settings/health, search sessions,
auth runtime, recovery claims, usage/notices and existing per-user state.
Creating tables early does not activate their future routes or jobs.

### Ordered implementation commits

1. **Stage configuration/runtime/database foundations.** Add the shared lazy
   state and TLS parser. Preserve a type-only schema import in DB code. Route
   all actual DB acquisition through lazy helpers and update their importers
   in this PR; `next build` must not validate a missing DATABASE_URL. Install
   the exact Better Auth pin and remove the incompatible root jose override.
   Reserve maintenance capacity now so later lease renewal does not change
   the pool-size contract. Fail invalid TLS selectors before network I/O.
2. **Generate the auth block on an independent empty database.** Add pure
   options/stubs and the `db:auth-ddl` script. Use a harness-owned CI checkout
   and `.env.local`; never point this command at the already-migrated app DB.
   Paste the generated block verbatim, then add the specified role/scope
   defaults/checks. Diff against a newly empty DDL database in CI.
3. **Write the full `0001` and registry.** Order enums/tables/FKs/indexes by
   dependency, including images before the settings logo FK. Add singleton
   checks, bigint revisions, composite same-post parent FK, nullable authorship,
   current moderation state, one-running-report unique index, positive lease
   fences and payload limits. Quote camelCase SQL identifiers. Seed through
   owning modules; do not introduce an alternate AI/settings secret reader.
4. **Wire transactional boot inside instrumentation.** Follow the exact design
   order: parse/neutralize → bounded database wait → outer transaction/boot lock
   → extension discovery/version → migration comparison/application → seed,
   auth secret, setup code and stale-run handling → commit → publish runtime
   state/banner/start sweeps. Pass the transaction to Kysely's non-locking
   adapter; inspect `.error`, propagate the original SQLSTATE and exit on
   failure. Bound the lock wait and keep heartbeat/wait logging alive. Do not
   destroy the pool used by the running app.
5. **Run boot and generate the final types.** Boot against the empty app DB,
   run `db:codegen`, commit the output, then finish the coordinated query/UI
   changes below. These bootstrap steps precede the final typecheck because
   old schema types still mention Org/UserOrg. The PR tip must typecheck; do
   not merge a temporary parallel legacy schema or a type-error suppression.
6. **Move routes and remove every tenancy input.** Move the board to
   `app/(board)`; remove org/claim/create/upsert routes and dead settings editors,
   tenant headers, identifiers, helpers, joins, enums and indexes. Preserve
   `board-state` navigation behavior. Rewire all seven absolute-URL consumers
   and the public feedback API; ignore the legacy orgId input only where the
   specified widget compatibility contract explicitly requires it.
7. **Bridge the pre-auth period explicitly.** `createContext` has no Firebase
   verification, a null session and `canAdminister=false`; protected procedures
   fail closed. Adapt the client auth context to the new session shape with
   a loaded, signed-out state and unavailable sign-in actions until P04;
   hide controls that would call removed upsert endpoints. No server or client
   may derive admin permission from a fabricated transitional role. Keep only
   the still-needed lazy Firebase imports until P04 removes them. The tRPC
   transport uses relative `/api/trpc`, omits credentials and sends no tenant
   or bearer header in this phase; it must not wait for Firebase authStateReady
   before public queries. P04 replaces this temporary transport with the
   resolved surface's real credential policy. The board
   does not redirect to nonexistent `/setup` before P04.
8. **Migrate every surviving query and caller.** Follow the design's Surfaces
   list and generate an actual import/caller inventory with `rg`. Write
   plainText and revision 1/disabled moderation state on keyless creates;
   content edits compare/increment revisions. Implement same-post reply/depth
   preflight and final checks before any future paid work. Add membership lock
   invariants to admin-changing queries; privileged HTTP remains closed in
   this phase. Replace `queries/save-insights.ts` with the typed disabled stub
   until P10; it must not insert incomplete report rows.
9. **Connect settings and remaining transitional UI.** SSR/poll the explicit
   public DTO, with chat/embeddings false irrespective of legacy AI env values;
   owner-only secrets never enter it. Apply settings CAS and refresh hints.
   Hide logo controls until P06. Workspace widget remains 2.12.1 until P16:
   interim snippets pass its required `platformId=""` plus the resolved root
   url, as specified. Protected AI routes reject unauthenticated access first;
   reachable public AI functionality returns AI_NOT_CONFIGURED. Authorized
   keyless AI behavior is exercised after P04. No model request is made.
   Search empty-state behavior must describe the transitional state.
10. **Sweep and finish static removal.** Use the documented short sweep
    transactions and exact advisory lock; skip image work until image writes
    arrive. Remove legacy migration scripts/schema dump, unsafe unused modules,
    bare server-only strings and the specified unused dependencies. Do not
    remove fixture-only references from the review archive to satisfy a code
    scan. P03 finishes framing/header work; its unimplemented gates are not
    counted as passes here.

Keep literal legacy-input payloads and environment-test values in named
`ci/fixtures/` JSON files, which are outside the design's app/script residue
scan; scripts consume them without spelling or dynamically constructing the
forbidden names. In particular, the old public API compatibility payload must
still be tested. This uses the existing scan scope; it does not add another
production-code exception or weaken the exact neutralization AST rule.

### P02 verification entrypoint and evidence

After generating schema/types through the isolated bootstrap workflow, run:

```text
npm ci
npm run build -w feedbackland-react
npm run typecheck
npm run build
docker build --tag feedbackland:ci .
npm run verify -- --phase 1 --image feedbackland:ci --artifacts artifacts/self-hosting
```

The phase-1 runner creates separate app and auth-DDL databases and executes
the documented `db:auth-ddl` and `db:codegen` scripts with those respective
URLs. It must compare generated output rather than rewriting the committed
files and treating the rewrite as success. Its dev-start smoke runs in its
own CI job with the required port free; a local clash must use an isolated
test environment, not stop an existing Postgres service.

| Check | Required observation | Design gate |
|---|---|---|
| Boot paths | next dev and standalone share boot; absent DB config fails at runtime, secret-free build still succeeds; unreachable DB exits within 100 s | V1 |
| Full schema | PG15 and PG18 with real pgvector, schema public/extensions, widths 768/3072, invalid 4096; all tables/constraints/indexes present; generated DDL/types match | V1; V8; V19/V21 schema |
| Transactional lifecycle | Two boots serialize; migration failure exposes its SQL error, rolls back schema/tracking/seed, releases lock, and next boot succeeds; transaction-pooler retry works | V3; V8 |
| Structural boundaries | Singleton violations fail; missing settings plus users fails; same-post FK, self-parent rejection, depth rules and unique running report hold | V14; V19 |
| Revisions | Two same-revision saves conflict; late vector/settings write is rejected; bigint round-trip stays a decimal string | V21 phase-1 legs |
| Admin membership | Actual serialized query modules on seeded users/sessions preserve at least one admin; API privilege remains unavailable until P04 | V19 phase-1 leg |
| TLS | Every selector/conflict/certificate rejection case, including ssl=true and CA-only; inspect pg_stat_ssl and trust/name failures on TLS fixtures | V22 parser; V10 TLS leg brought forward |
| Public board | `/` works without tenant resolution; create anonymous text post through API with CORS; item survives restart; no sign-in/setup redirect or model call in this phase | V3; V6; V7 phase 1 |
| Secrets/pools | Settings HTML/API contain no secrets; injected secret never persists/logs; generated secret stable across restart; all bundle layers share configured pool total | V1; V7 |
| Removal | AST exception only for exact neutralization literals; residue and actual deletion checks run together; no old upsert route/org schema; guarded imports remain correct | V6; V7 |

- [x] Every row is green locally; all P01 checks remain green.
- [x] The phase report lists auth/upload/search/AI limitations honestly.
- [x] PR includes generated DDL/types and a real caller-removal inventory.
- [x] No test or script touched an existing application database.

The [P02 implementation evidence](../reviews/2026-10-18-p02-implementation-evidence.md)
maps each row to the successful run and records the private setup-code origin
flag discovered during implementation. The
[caller inventory](../reviews/2026-10-18-p02-caller-inventory.md) records actual
importers. These local checks do not replace green CI at the final PR revision
or independent review before merge.

**Rollback:** revert on the integration branch and recreate only its disposable
DB when returning to the legacy schema. An operator DB unexpectedly containing
hosted tables must be rejected by the execution setup; never “fix” it by dropping
tables. **Next:** P03; P02 itself is not a release candidate.

## Remaining PR cards

Each card inherits the execution rules. Its gate list identifies the newly
activated legs; all applicable preceding legs remain blocking. The design's
complete V0–V23 descriptions supply the negative cases, not just the happy paths
summarized here.

### P03 — Surface isolation, framing and navigation (phase 2)

Execution update (2026-10-21): P01 and P02 are merged into the integration
branch. PR #13 resolves the six P02 review findings and four follow-up review
findings; retain all those fixes while
developing P03 and merge that follow-up first. P03's internal edit order is:

1. Resolve the board surface before mounting any credential/query provider;
   isolate and dispose transport, query and board state per surface. Give admin
   and later auth routes explicit first-party providers outside the board.
2. Add the ordered framing rules and server-side public metadata/UUID checks;
   retain unresolved SSR without a trusted proxy hint.
3. Preserve embed/mode on navigation, reload and errors; close framed admin
   rendering and embedded administrative controls. Harden content output and
   consolidate clipboard fallbacks.
4. Add phase-2 header/content checks and a real widget/Chromium harness with
   sentinel-cookie and first-request observations, missing-hint hydration,
   surface remount/cancellation, reload and RSC failure/identity changes.
5. Run all preceding gates plus the phase-2 legs against the exact built image,
   record evidence, and submit P03 independently for review. P04 is excluded.

**Entry:** P02. **Files:** root/board/first-party layouts,
`providers/{embed,surface}.tsx`, auth/tRPC provider placement, `proxy.ts`,
`lib/{embed-surface,board-href,copy-text}.ts`, `next.config.ts`, metadata/icon,
post UUID route, global error page and Tiptap output/status/link handling.

- [x] Establish the exact provider tree and unresolved state before auth work.
      Cancel work/discard surface caches on remount; outside-board pages use
      explicit first-party providers. Public SSR ignores ambient navigation cookies.
- [x] Implement header ordering, any-match embed parsing, framed admin refusal,
      preserved query/mode through navigation/reload/errors and clipboard fallback.
- [x] Add `scripts/drawer-auth-check.ts` and the phase-2 V19 harness. Before
      P04 use sentinel cookies and instrumented public/script requests; P04
      repeats these tests with actual first-party/embedded admin sessions.

**Exit:** V5 navigation and V7/V19 phase-2 legs pass. No claim of working sign-in.
**Revert boundary:** UI/provider/header change; retain P02 schema. **Next:** P04.

**Evidence (2026-10-21):** [implementation and limits](../reviews/2026-10-21-p03-implementation-evidence.md)
and [16 passing cumulative groups](../reviews/2026-10-21-p03-verification.json).
Development boot/migration/settings smoke also passed. P04 remains unstarted
until the review-fix follow-up and this milestone are reviewed and merged.

### P04 — Setup and complete credential authorization (phase 3)

**Entry:** P03. **Files:** `lib/auth/{server,client,authorization,popup-handoff}.ts`,
auth options/types, auth route, setup pages/actions, auth hook/providers,
`lib/trpc.ts`, all four author-or-admin query paths, invite redemption,
chat/tRPC CSRF guards and schema-drift/browser tests. Delete Firebase/config.

- [ ] Implement cookie/bearer separation, immutable scope, signed bearer and
      first-party header/cookie stripping; one full canAdminister predicate.
- [ ] Add random code validation, setup dedicated connection/locks, pre-setup
      write lockdown, invite scope/expiry/email checks and final-write rechecks.
- [ ] Remove the disabled auth bridge; make sign-in/up/out, own-content actions
      and admin access work in the correct surface. Preserve undefined avatars.

**Exit:** V1 auth-DDL/signup; V5 three-engine email flow; V7/V19 authorization
matrix and V22 code rules; V2 manual without search/images. Replay drawer admin
as bearer **and** cookie against all privilege overrides. **Revert boundary:**
only disposable integration installs; never reopen claimed setup. **Next:** P05.

### P05 — Social auth and operator recovery (phase 4)

**Entry:** P04. **Files:** popup routes/plugin, OIDC epoch/retry, mail/reset and
recover routes, admin reset links, claim persistence, HTTPS/COOP/IdP/Mailpit fixtures.

- [ ] Implement server-mediated handoff with callback binding/polling, provider
      token removal, discovery convergence and configured provider visibility.
- [ ] Implement admin reset and zero-admin recovery, owner-fenced claims,
      interrupted reset/promotion handling and session revocation.

**Exit:** V5 social/COOP/Helmet; V7 phase 4; V19 two-replica discovery/avatar;
V22 recovery and code removal. Real Google/Microsoft device checks remain due
at release. **Revert boundary:** revoke pending test flows; do not restore old
session secrets to make a broken test pass. **Next:** P06.

### P06 — Images and attachment recovery (phase 5)

**Entry:** P05. **Files:** image routes, `lib/http/limited-body.ts`, container
metadata validators, editor upload/paste/drop/logo flows, image references/locks,
reclaim action/System control and `scripts/e2e/v4-backup.ts`.

- [ ] Implement complete-stream/part/deadline/process limits, bounded GIF work,
      static PNG/WebP checks and reference validation before/final write.
- [ ] Serialize upload/attach/detach/logo/delete/sweep/reclaim quota changes.
      Add pending-usage preview/reclaim; explain direct EXIF and draft grace.
- [ ] Enforce other public body caps and remove Supabase plus all remaining
      NEXT_PUBLIC variables. Restore an attachment-containing dump privately.

**Exit:** V7 phase 5, V20 upload/quota/container races, V4 attachment restore
and V2 manual with images. **Revert boundary:** attachment bytes remain DB data;
take a dump before any destructive test. **Next:** P07.

### P07 — AI foundations and accounting (phase 6a)

**Entry:** P06. **Files:** `lib/llm/{constants,defaults,settings-store,client,fetch,
errors,usage,input-budgets,model-profiles}.ts`, secret box, budget functions,
`ai_health` access and mock OpenRouter fixture. Extend the seed-only store.

- [ ] Add exact transport/tokenizer pins, one fixed endpoint/manual redirects,
      provider objects/privacy handling, response bounds, mapped errors and
      process admission before image-byte loading. No feature bypasses this layer.
- [ ] Implement configuration revision/full-key token, per-capability dispatch
      sequence, async CAS and effective-environment divergence handling.
- [ ] Implement UTC admission/reservations/diagnostic and metadata allowances,
      all retries/output/input budgets and explicit uncosted usage.

**Exit:** real store/budget/transport tests under V12/V20/V21; reflected private
markers cannot reach any sink. Feature endpoints remain gated until wired in
the following cards. **Revert boundary:** disable AI; preserve ciphertext/usage.
**Next:** P08.

### P08 — Content AI and moderation coverage (phase 6a)

**Entry:** P07. **Files:** moderation/title/rewrite modules, four content writes,
rewrite route/form, current moderation state/event queries, Activity filter and
keyless title/category behavior.

- [ ] Move model work outside transactions, revalidate authority/revision/refs
      before final commit, and route every request/retry through P07 admission.
- [ ] Wire allowed/refused/unavailable/partial coverage semantics, saturation
      rejection and daily-limit anonymous versus signed-in behavior.
- [ ] Preserve draft images and distinguish current state from historical counts.

**Exit:** V11/V12 content paths, V20 vision memory/abort/logging, V21 coverage
revision transitions and V7 feature routing. **Revert boundary:** turn AI off;
stored content remains valid keyless content. **Next:** P09.

### P09 — Embeddings, maintenance and durable search (phase 6a)

**Entry:** P08. **Files:** `lib/jobs/leases.ts`, embeddings/probe/preparation,
backfill/rebuild store, `lib/search/sessions.ts`, board/activity search and
housekeeping. Wire epoch checks to the existing vector metadata helper.

- [ ] Implement tokenizer profiles and batch caps; first-dispatch generation
      initialization; revision/epoch-fenced vector writes and all-replica width refresh.
- [ ] Run independent renewable maintenance leadership with no overlapping
      ticks; credit eligibility cannot depend on successful embeddings.
- [ ] Materialize ordered search sessions, exact unindexed tier, bounded TTL/
      capacity/row payload, shared page reads and explicit restart semantics.

**Exit:** V8 real-vector topologies/order; V13; V21 rebuild/stale-write/tokenizer/
lease/outage/budget/pagination races. Exact search now works without AI.
**Revert boundary:** disable semantic work; rebuild is the only model/width
transition; never silently restore a distance cursor's old meaning. **Next:** P10.

### P10 — Background insights (phase 6a)

**Entry:** P09. **Files:** insight job module, start/read procedures, same-run
save query, report/status UI and stale-job handling; delete old synchronous route.

- [ ] Atomically create singleton run/lease, freeze bounded snapshot/plan,
      reserve chunks plus merge, and guard every stage/final write by owner/fence.
- [ ] Remove hidden retries, handle reservation-day expiry and fail crashed
      runs rather than silently resuming paid work. Clear retained snapshots.

**Exit:** V21 concurrent starts/reservations/merge accounting/worker death/late
completion; V12 report errors. **Revert boundary:** fail active jobs, preserve
successful reports and consumed allowance. **Next:** P11.

### P11 — AI onboarding and active status (phase 6b)

**Entry:** P10. **Files:** AI settings/System pages and procedures, Connect
return/headless flow, key checks, credit wait, notices, status polling and public
settings capabilities. Finish discovery retry and reclaim placement in System.

- [ ] Implement admin CAS actions, encrypted server-held verifier, echoed state
      plus path nonce, key confirmation, environment locks and Keep AI off.
- [ ] Atomically bind enable/check results to the replacement token; close-tab
      credit checks use P09 leadership and honor ordinary budget availability.
- [ ] Wire visible client polling, focus refresh, stale/offline handling and
      UTC rollover; cost UI shows bounded scenarios and explicit unknowns.

**Exit:** V18; V21 stale-key/enable/health races; V23 same-DOM multi-tab/drawer
tests. **Revert boundary:** keep AI off and preserve encrypted key; never undo
another admin's newer revision. **Next:** P12.

### P12 — Integrated acceptance and design-branch merge (phase 6 gate)

**Entry:** P11. **Files:** complete CI matrix/harnesses, independent fixture
sets, manual evidence and the design-to-implementation ledger.

- [ ] Run cumulative exact-image V1–V23 legs due through phase 6: primary,
      keyless, broken provider, search/index states, authorization, body/memory,
      concurrency and active-client behavior. No future phase-7/8/9 check is
      misreported as passed.
- [ ] Add the independent selection/held-out moderation fixtures and maximum
      request/cost fixtures. Record real default-model width/search/privacy
      checks and real Connect behavior required by phase 6.
- [ ] Prove keyless DNS **and literal-IP attempt** absence with optional
      auth/mail off and a positive-control observer. Scan logs/responses/state
      for private markers across every model path, not only the first wired path.
- [ ] Reconcile the 41-row ledger below against actual passing test names and
      open future operational obligations. Only then complete #10's integration
      merge, provided P00 remains satisfied.

**Exit:** phase 6 complete with committed evidence and no unresolved due finding.
Do not use review-count or synthetic SQL success as acceptance. **Next:** P13.

### P13 — Production packaging and operations (phase 7 machinery)

**Entry:** P12 merged. **Files:** release workflow, Render/rc definition,
Railway spec, TLS/external-DB Compose, backup profile, major-upgrade overlay,
Kubernetes, README/SELFHOSTING/env reference, CONTRIBUTING/SECURITY.

- [ ] Build both architectures natively, record child digests/identities,
      enforce same-artifact replicas/Recreate and old-client reload behavior.
- [ ] Implement validated backups, protected recovery inventory/off-host
      runbook, preserve/rotate restore, new-volume 17→18 upgrade and first new
      scheduled backup restoration. Record measured resource/RPO/RTO evidence.
- [ ] Complete code-generation/dependency cleanup and accurate install/docs
      claims; keep generated platform code encodings and production PG support
      policy aligned. Release machinery first publishes edge; GHCR visibility
      change is a separately recorded release-owner action before rc tagging.

**Exit:** V4 full, V7 phase 7, V10, V22 full and V23 artifacts/upgrade constraints;
root package at rc.1. **Next:** public rc.1 operation, then P14.

### P14 — Published-candidate lifecycle (phase 7 lifecycle)

**Entry:** P13; release owner has made GHCR public and tagged rc.1 on main.
**Files:** release/lifecycle CI and `9999_v3_probe` fixture wiring/evidence.

- [ ] Pull rc.1 only as the old side; upgrade to a CI-built candidate with the
      registered fixture migration, then stop/start back to rc.1. Verify data,
      newer-database handling and old-client reload behavior.
- [ ] Enforce tag/version/main ancestry, immutable artifact/provenance rules
      and rollback notes. If fixes are needed, publish rc.2 after the fix;
      rc.1 remains the old-side baseline, not a moving substitute.

**Exit:** V3 real-artifact upgrade/rollback and V23 release contract pass.
**Next:** P15 against the latest passing candidate.

### P15 — Real one-click target acceptance (phase 7 target walk)

**Entry:** P14. **Files:** target definition fixes and recorded V9 walkthrough.

- [ ] Deploy through render-rc and an unpublished Railway template without a
      terminal; copy generated setup code from the dashboard; setup/post/embed.
- [ ] Verify actual secret encoding, custom domains/callbacks, client-IP edge
      behavior, cost/storage options, update-tag behavior and single-version
      traffic cutover. Automatic Railway registry updates stay disabled.
- [ ] Record fresh-target injected-secret restore and platform-specific backup
      limits. A target failing its cutover contract must not be advertised as
      supported through an untested upgrade procedure.

**Exit:** V9 plus applicable V22/V23 manual target evidence. Fixes require a new
passing candidate before final signoff. **Next:** P16.

### P16 — Widget v3 and publication machinery (phase 8)

**Entry:** P15. **Files:** widget source/metadata/README, packed host fixture,
app snippets/docs and trusted-publication workflow.

- [ ] Require root board URL, remove hosted/id fallbacks and interim platformId,
      preserve sandbox/postMessage/readiness/CORS behavior and useful errors.
- [ ] Test the npm-packed artifact, React peer compatibility and HTTPS/mixed
      content cases; configure trusted publishing without publishing stable early.

**Exit:** V15 and packed-widget V5, real browser/device release checks due by
P17. **Revert boundary:** do not deprecate 2.x before retirement is ready.
**Next:** P17.

### P17 — Stable release and retirement (phase 9)

**Entry:** P16, all release checks, actual P00 notice/export dates and named
release owner. **Files:** stable versions, frozen render-v1/template contracts,
retirement record and final release notes.

- [ ] Execute stable app/widget publication and public target creation in the
      design's order; run anonymous pull and README-button smokes on actual tags.
- [ ] Complete parking/readiness/API-410/CORS behavior, npm deprecation, private
      export retention and credential/project retirement at the recorded dates.
- [ ] Record continuing domain/parking/payment/backup-owner responsibility.
      Do not mark the release complete because only the tags were published.

**Exit:** V0 retirement, V9 stable smoke, V6 full scope and V23 records; required
real Google/Microsoft/Safari/iOS and paid OpenRouter checks recorded for this release.
**Next:** optional P18. No automatic PR merge or external account operation is
authorized merely by this planning document.

### P18 — App-store wrappers (phase 10)

**Entry:** P17. **Files:** `scripts/gen-wrappers.ts` and one `deploy/<store>/`
wrapper/evidence set per PR for Umbrel, CasaOS, Coolify, Dokploy, Easypanel,
Zeabur and CapRover.

- [ ] Generate from the supported image/configuration contract; detect drift.
- [ ] Walk actual install, generated code retrieval, setup and restart persistence.

**Exit per store:** V17 manual plus wrapper-drift CI. An untested store remains
unadvertised. Store submission/activation is a separate explicit owner action.

## Review-to-PR closure ledger

“Implementation” identifies the code owner; “closure” identifies the PR that
must supply the complete relevant proof. Early schema/helpers do not close a
finding whose real endpoint, second replica or release target is not yet tested.

| Item | Implementation PR(s) | Closure evidence |
|---|---|---|
| F01 | P04, P08 | P04 V19 privilege matrix; P08 delayed-authority final-write checks |
| F02 | P03, P04 | P04 V5/V19 actual admin cookie/token from first script subrequest and public SSR |
| F03 | P02, P13 | P02 V22/V10 parser/negotiated TLS; P13 external-DB target smoke |
| F04 | P06 | P06 V20 full multipart/deadline/cancellation cases |
| F05 | P07, P08 | P08 V20 bounded cgroup memory and no saturation publishing bypass |
| F06 | P13 | P13 V22 real new-volume major upgrade, new backup restore and rollback |
| F07 | P07, P08, P10 | P12 V20/V12 all error sinks and all feature paths |
| F08 | P09, P11 | P11 V21 closed-tab unpaid/none/failed-probe cases |
| F09 | P09 | P09 V21 B remains running across A's width rebuild |
| F10 | P09 | P09 V8/V21 varied strict/materialized candidate traversal |
| F11 | P09 | P09 V21 mode/expiry/rebuild/outage/budget/cross-replica pagination |
| F12 | P02, P07, P08, P09 | P02 structural CAS; P12 V21 content/config/vector integration |
| F13 | P06 | P06 V20 upload/ref/logo/delete/reclaim/sweep concurrency |
| F14 | P10 | P10 V21 one run/lease/reservation and stale publication refusal |
| F15 | P10 | P10 V21 actual chunk-plus-merge dispatch count and day expiry |
| F16 | P07, P10, P11 | P12 V21/V23 maximum request shapes, retry/diagnostic accounting and honest prices |
| F17 | P07, P11 | P11 V21 same-suffix key replacement and stale async enable/check |
| F18 | P02, P11 | P11 V23 existing DOM/other tab/UTC rollover; P12 cumulative regression |
| F19 | P06, P13, P15 | P13 V22 full preserved/rotated-secret bundle; P15 fresh platform target |
| F20 | P13 | P13 V22 invalid/rename/dump/retention failure matrix |
| F21 | P01, P03, P13, P15 | P13 V23 native child digests/replicas/reload; P15 observed target cutover |
| F22 | P07, P09 | P09 V21 shared multilingual token preparation on real write/backfill paths |
| F23 | P02, P08 | P02 V19 FK/depth; P08 proves rejection before any provider call |
| F24 | P02, P04, P05 | P05 V19/V22 mutual demotion, zero admins and interrupted/concurrent recovery |
| F25 | P05, P11 | P05 V19 A retry/B social start; P11 System retry control |
| F26 | P02 | P02 V6 exact AST exception and actual neutralization together |
| F27 | P04, P05, P13 | P04/P05 V22 byte/weak-code rules; P15 V9 real platform generators |
| F28 | P09, P10 | P10 V21 >90-second work, renewal, stall/death, takeover and stale fence |
| F29 | P04, P05 | P05 V19 actual Better Auth undefined-image/name-only/provider callback paths |
| A01 | P02, P08 | P08 V21 current versus history, repeated edits, deletion and expiry |
| A02 | P09 | P09 V21 null/skipped exact tier during partial indexing |
| A03 | P07, P11 | P11 V21 per-capability ordering and obsolete key/enable/Keep-off results |
| A04 | P06, P11 | P06 V20 safe reclaim race; P11 actual System control/status |
| A05 | P06 | P06 V20 EXIF honesty and bounded supported animation/container fixtures |
| A06 | P12 | P12 V16 disabled optional integrations plus DNS/syscall positive control |
| A07 | P12 | P12 V23 independent held-out moderation and maximum-cost/input fixtures |
| A08 | P13, P15 | P13 V22 encrypted off-host drill/retention/RPO/RTO; P15 platform records |
| A09 | P01, P13 | P01 V23 poisoned env_file; P13 V10 actual platform PORT behavior |
| A10 | P11, P12 | P11 V18 state/path/admin/mode binding; P12 real dated Connect check |
| A11 | P02, P13 | P02 full PG15/18 matrix; P13 release-date support-policy check |
| A12 | P00, P17 | P00 pre-flight records; P17 V0/V23 actual dates/exports/revocations/continuing ownership |

## Final check before starting implementation

- [ ] Confirm the baseline/target branch and P00 owner/evidence.
- [ ] Confirm a real container execution environment; old synthetic proof output
      does not establish image readiness.
- [ ] Start P01 only, using its stated files, entrypoint and acceptance rows.
- [ ] Record surprises as concrete failures and adjust the smallest affected
      contract/PR boundary with its tests; do not weaken a security invariant or
      claim completion from an unexecuted future gate.

**Stop for this planning task:** leave the plan ready for review. Do not begin
P00/P01, create branches, run application/container workloads, commit, push or
change #10 until the user requests the next action.
