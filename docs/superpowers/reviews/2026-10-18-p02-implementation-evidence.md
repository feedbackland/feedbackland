# P02 implementation and verification evidence

P02 implements the single-tenant schema and transactional boot milestone from
the [execution plan](../plans/2026-10-18-self-hosted-single-tenant-implementation-plan.md#p02--single-tenancy-schema-and-boot-detailed).
It is a pre-release milestone requiring independent PR review before merge.
P03 has not started. The external retirement-owner prerequisites recorded in
P00 remain operator work; this implementation does not certify their completion.

## Delivered behavior

Instrumentation runs the same boot entrypoint in development and standalone
production. Boot validates configuration, waits for the database with a deadline,
takes the transaction-scoped boot lock, discovers pgvector, applies the static
migration registry and seeds singletons/secrets in one transaction. A failed
migration retains its original SQLSTATE and rolls back schema, tracking and seed.
An unrecognized existing schema is refused without deleting its contents.

The public board lives at `/`. Anonymous text submissions work through the board
and the public feedback API, use deterministic keyless titles and persist across
restart. Settings use an explicit public DTO, SQL revision CAS and visible-page
polling. Tenant routing, schema, transport inputs and obsolete callers are removed.
Privileged HTTP procedures reject access during the pre-authentication phase.

The schema includes the later milestone tables and constraints without activating
their routes or jobs. Authentication/setup, uploads, AI and exact/semantic search
are unavailable. Search and comment UI state those limitations. Framing, surface
isolation and remaining metadata work belong to P03.

## Local verification

The successful full run is `p02-1792354586035-d81b4501`; all 13 reported groups,
including both cleanup groups, passed. Its fixture-only
[machine-readable report](2026-10-18-p02-verification.json) is preserved here.

- Integration base: `553fc42d281316cd1e43955212bc6849f656cd4b` (merged P01).
- Docker image: `sha256:f6fa3e8477bf11c90d5225ceff778bfee0ca6459a14e96d6206566fe9714eb5b`.
- Source-tree fingerprint: `88a693fb82bda88556711b4a68e5ef0fb27fbef05868765b295d52a1fcd28954`.
- Image artifact identity: `d734a10c3124ad81cb48d1fde3e634e8b69c0bd89732c5245943280002b91c25`.
- Host: Windows, Node 24.15.0, Linux Docker Desktop. Service images are pinned
  by digest in the fixture Compose files.

This image was built from the uncommitted implementation, so its `sourceCommit`
is honestly `null`; the report's `checkout` is the integration base, not an
assertion that the changes were already committed. The verifier matched the
image's source fingerprint to the working files. CI rebuilds its checkout with
`SOURCE_COMMIT=github.sha`; CI reports must be evaluated at the PR's final revision.

| Plan requirement | Observed evidence |
|---|---|
| Boot paths | Secret-free host and offline Docker builds passed. Separate development smoke passed migration, singleton settings, root rendering and cleanup. Standalone fatal exits: absent URL 1,325 ms; unreachable DB 91,116 ms; conflicting TLS 1,426 ms. |
| Full schema | All eight PG15/PG18 × public/extensions × 768/3072 combinations passed with real pgvector 0.8.7. Actual generated Better Auth DDL matched verbatim; generated schema types matched all eight cases. Width 4096 failed before migration. An existing unrecognized schema was preserved and refused. |
| Transactional lifecycle | Two real boot processes blocked behind a held boot lock, then committed one migration. Deliberate failure returned 42P01, rolled back migration/tracking/seed, released the lock and retried through transaction-mode PgBouncer. |
| Structural boundaries | Actual migrated DB rejected duplicate singletons, missing settings with users, cross-post/self-parent replies and duplicate running reports. Actual reply queries accepted depth eight and rejected nine. |
| Revisions | Actual feedback/comment/settings query races accepted one save per revision. Late vector writes lost their CAS. Decimal strings beyond JavaScript's safe integer range round-tripped; maximum bigint overflow raised 22003 without wrapping. |
| Admin membership | Real invite, redemption and serialized demotion query modules were exercised with seeded sessions/users; concurrent demotions preserved an admin. Scope, expiry and age checks failed closed. Privileged HTTP remained unauthorized. |
| TLS | Three plaintext, two encrypted-unverified and four verified policies passed; accepted connections were checked with pg_stat_ssl. Wrong CA, hostname/IP and expired certificates failed. Parser cases cover duplicate/conflicting selectors, aliases, malformed certificates and unsupported certificate-file options. |
| Public board | Root HTTP 200, anonymous API 201, legacy widget payload compatibility, CORS on success/validation/database failure, protected HTTP 401 and public AI_NOT_CONFIGURED passed. The item survived restart. Browser interaction submitted and opened a post, showed the unavailable comment state, and returned to the board. Database workers prohibit fetch and assert zero model requests. |
| Secrets/pools | Explicit public settings and HTML excluded fixture secrets; injected auth secret was absent from persistence and injected secrets were absent from logs. Generated credentials remained stable. Concurrent RSC/settings/health traffic shared one app connection with pool total two, reserving maintenance capacity. |
| Removal/P01 | AST scan checked 405 source files and the exact 17-literal exception; malicious extra/computed references were rejected and actual environment deletion passed. Scoped lint passed for 190 changed/server/test files. Original image/filesystem, read-only/tmpfs, runtime constants, port/hostname and outage/concurrency/recovery gates passed. Forty health requests stayed bounded and recovery required no app restart. |

`npm ci`, widget build, TypeScript checking, host production build, offline
Docker build, the complete phase-1 verifier and the separate development smoke
were run. The verification scope does not claim that pre-existing unrelated UI
lint errors were repaired. The [caller inventory](2026-10-18-p02-caller-inventory.md)
records actual static importers rather than claiming every future path is active.

## Implementation discoveries and harness repairs

The private singleton stores `setupCodeGenerated`, default false, alongside its
setup code. This records whether the application generated the code: removing an
injected SETUP_CODE on a later boot must never turn that private operator value
into a printed generated-code banner. The design schema and display rule now
record this requirement. Database tests cover injection, environment removal,
generated-code stability, claim clearing and ignored weak code after claim.

Two local verification defects were corrected before the final successful run:
the observer transaction clears its PostgreSQL statistics snapshot while waiting
for concurrent boots, and the restart check re-inspects Docker's published port
because Docker Desktop may assign a different ephemeral host port after restart.
The earlier failed run is not counted as a pass. Neither repair weakens an
application assertion or changes production behavior.

Every database used here was created inside a harness-owned disposable Docker
service; tools refuse operator dotenv files and child tools receive a restricted
environment. Existing Windows PostgreSQL services and application databases were
not used. The verifier confirmed deletion of its owned projects, containers and
certificate volume. Browser/bootstrap fixtures are separately removed after QA.

## Review handoff

Review migration/schema agreement, the non-locking Kysely adapter within the outer
transaction, pool sharing across Next bundles, TLS normalization, secret origin
handling, revision races and membership serialization before merging. CI adds the
Linux development/standalone runs at the submitted revision. Independent review
and a green final PR revision remain merge prerequisites; local tests alone do
not satisfy those prerequisites. P02 is not a release candidate.
