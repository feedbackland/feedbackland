# P00 local pre-flight and P01 foundations

Date: 2026-10-18. Integration baseline: `62a158fa27cee685682bde0b1f730a42412240f7`.
Implementation branch: `codex/self-hosting-foundations`; PR base:
`single-tenant-self-hosting`. P02 has not started.

## P00 boundary

Local pre-flight passed in a new managed Git worktree, without copying hosted
dotenv files, credentials, dependencies or databases from the operator checkout.
Only the tracked `.env.example` was present initially. Dependencies were installed
from the committed lockfile. The test harness passes a restricted OS/tool
environment to children and creates its own fixture-only Compose directory,
database, random ports, project names and volumes. The build context excludes
dotenv files and nested npm configuration. Existing operator files, Windows
Postgres services and volumes were not changed.

Host: Windows/amd64, Node 24.15.0, npm 11.12.1. Docker Desktop was installed but
stopped; starting it established Linux Docker Engine 28.3.0 and Compose 2.38.2.
The Node 24 trixie-slim multi-architecture index digest is pinned in Dockerfile.
Local execution used linux/amd64; native arm64 distribution is a later release
gate, not claimed here.

The **external P00 gate remains pending**: release/backup owners, hosted Git
deployment disconnection, npm account remediation, domain continuity,
notice/export/shutdown dates and private export handling require actual operator
records. None was performed or marked complete by this implementation. P01 does
not authorize hosted retirement, merge to main, or a release.

The legacy Vercel integration still creates preview checks. The user supplied
the failed preview's diagnostic: its deploymentId exceeded Vercel's 32-character
limit. PR review corrected this by retaining the full artifact hash and deriving
a separate 32-character deploymentId. Vercel passed on commit `99db446`.
Its eventual disconnection remains an external P00 owner action, and P00 is not
complete. See the [full PR review](2026-10-18-pr-11-review.md) for later corrections.

## Baseline and prerequisite fixes

An archived clean baseline with its own `npm ci` installation passed the widget
build and root typecheck. Its application build compiled, then failed while
collecting `/[orgSubdomain]/form`: `supabaseKey is required`. P01's lazy delegates
remove import-time Firebase/Supabase initialization; first use retains SDK
receiver binding, successful initialization is memoized, and failed factories
can retry. Tests use fixture identities and perform no hosted requests.

The original `npm run lint` crashed in eslint-plugin-react 7.37.5 because ESLint
10 removed `RuleContext.getFilename`. The minimal `@eslint/compat` wrapper restores
the plugin APIs without disabling rules or excluding application files.
Repository lint now reports **30 errors** in existing UI code. Running the
unchanged baseline with the same compatibility wrapper produced the identical
30 error locations/rules. Every changed code file passes lint. The full-repository
lint failure remains visible; it is not represented as a passing P01 check or
hidden behind an exclusion. Those UI diagnostics are outside the container and
readiness changes.

The stricter bundled-identity assertion found a second prerequisite issue:
Next 16.3.5 replaces BUILD_ID with a constant when deploymentId is configured,
ignoring an explicit generateBuildId. Next 16.3.8 retains that behavior. P01
therefore updates Next to the stable 16.4.2 release, which includes the
[upstream fix](https://github.com/vercel/next.js/pull/99147). Bundled BUILD_ID
must equal the full artifact identity; deploymentId must equal its generated
32-character derivative so it also satisfies Vercel. Both assertions are retained.
This is an evidence-driven implementation adjustment
to the planning baseline, not a relaxation of the identity contract.

## Acceptance evidence

The shared entrypoint is:

```text
npm run verify -- --phase 0 --image feedbackland:ci --artifacts artifacts/self-hosting
```

Each run recomputes the current source-tree identity, rejects a mismatched image,
and records image id, architecture, source commit when supplied, version and
individual results. CI supplies the exact checkout SHA as SOURCE_COMMIT to both
the host and Docker builds. The generated identity also supplies Next BUILD_ID
and deploymentId. Generated evidence stays under the ignored artifacts directory;
CI scans it before upload. The final PR describes its latest exact-commit run.

| P01 assertion | Observed result |
|---|---|
| Credential-free build | Widget, typecheck and Next production build pass without app credentials or DB input |
| No build egress | Docker application build passes under `RUN --network=none npm run build`; telemetry disabled |
| Artifact hygiene | No `.env*`, sharp or @img anywhere in final image; application files root-owned; no app scripts directory |
| Runtime entry | USER node; direct `node server.js`; inherited base entrypoint explicitly cleared |
| Readiness | Empty database returns 200 and only status/version; no public application tables exist |
| Outage/recovery | Stopped DB returns 503; restored DB returns 200; application restart count stays zero |
| Concurrent stall | Forty requests against a paused DB all return 503; initial integration run maximum 1,789 ms |
| Delayed acquisition | Actual route test proves one pending probe across 40 timed-out callers, handles late rejection, then recovers |
| Immutable runtime | Read-only root with only `/tmp` and `.next/cache` tmpfs; writes elsewhere fail; health and static page work |
| Hostname/port | Direct image serves on 8080 despite Docker hostname `bogus`; explicit invalid HOSTNAME exits 1 with ENOTFOUND |
| Compose invariants | Poisoned fixture env_file cannot override the five fixed runtime constants; bundled DB port unpublished |
| Development DB | Separate dev-db volume, PG18 parent mount, ephemeral localhost port, SELECT 1 succeeds |
| Resource ownership | Generated test containers, volumes and networks removed; no blanket prune or operator project teardown |

Initial image integration run: `p01-1792323467842-2cc15802`, image id
`sha256:4ed8c75209d0360866641d5379d56d9129b5030b112b8aae340f8f5515965729`.
Subsequent verification tightens delayed-failure, stale-identity and bundled-id
checks; exact-commit reruns are required before the PR is ready to merge.

## Review and next boundary

The review pass checked SDK receiver/retry behavior, timeout and release paths,
stale image detection, inherited Docker entrypoint, filesystem ownership, decoy
dotenv exclusion, Compose contamination, test cleanup and CI phase scoping.
It added the explicit late-rejection test and excluded nested npm configuration.
This record describes implementation verification and a self-review, not an
independent reviewer approval. The separate P01 PR is the independent review
boundary and must receive review before landing on the integration branch.

The image is transitional. Existing tenancy/auth/uploads/AI remain legacy code;
no migrated board, setup, keyless runtime egress guarantee, release image,
production backup or upgrade/restore acceptance is claimed. README and
SELFHOSTING carry that status. Keep #10 unmerged until P00/P12 pass; begin P02
only after P01 is reviewed and accepted.
