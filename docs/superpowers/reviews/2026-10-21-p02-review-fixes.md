# P02 review fixes

The review of PR #12 at `ae2e05fe859955f27d6c6d32febea6cd02ba8b62`
identified five P2 defects and one P3 inventory defect. PR #12 merged into
`single-tenant-self-hosting` while these fixes were being validated. This
follow-up targets that integration branch and resolves all six findings.

| Finding | Resolution | Regression evidence |
|---|---|---|
| TLS policy overwritten by URL parsing | Reject `sslnegotiation`, including mixed-case names, before constructing a connection. | Parser rejection cases and effective `pg.Client.connectionParameters.ssl` checks with system/custom CAs; existing live TLS matrix remains blocking. |
| Unavailable authentication reachable from votes | Gate the shared dialog, method selector and reset form; guard and disable both vote controls with an accessible explanation. | Actual React component rendering covers every method and both controls; standalone browser clicks on post/comment votes and Reply expose no auth dialog. |
| Settings revision stays stale after save | Await invalidation/refetch of the private `getSettings` query before completing the mutation callback; retain the router refresh and optional public broadcast. | The actual hook, tRPC context, QueryClient and active QueryObserver perform two consecutive saves with revisions 1 → 2 → 3, without reload/focus/remount. BroadcastChannel is absent during this test. |
| Expected domain errors become HTTP 500 | Introduce typed domain failures and shared tRPC middleware. Invalid content/revisions/parents return 400, conflicts 409, authorization failures 401/403 and missing invites 404. | The real fetch adapter and seeded database exercise these responses. An ordinary `Error("CONFLICT")` still returns 500; unexpected database errors are not blanket-mapped. |
| Escaping changes the accepted input limit | Share a 10,000 UTF-16-code-unit raw-text bound between textarea and tRPC; escape on the server after validation. Preserve the separate legacy HTML API contract and its 48,000-byte bound. | Actual adapter/database boundary cases cover ampersands, both angle brackets, newlines, emoji, literal image markup, excess length and empty input. Browser submission stores 10,000 ampersands as 50,000 encoded characters. |
| Caller inventory misses module resolution | Use TypeScript's tsconfig-aware resolver for imports and re-exports; regenerate the inventory and enforce `--verify` in CI. | A temporary fixture covers directory/index aliases, parent-relative imports, explicit extensions, re-exports, unused modules and non-mutating drift rejection. |

The settings test uses an in-memory tRPC transport only for cache behavior;
the independent database/adapter tests exercise actual revision writes and
conflicts. Seeded request contexts are internal harness fixtures, not a
production authentication switch. Public privileged HTTP remains closed.
The phase-1 database workers prohibit outbound fetch and retain their zero-
outbound-request assertion.

No database migration or dependency change is required. Firebase remains
scheduled for deletion in P04; its reset UI and submit handler are unreachable
while authentication is unavailable. These fixes do not activate setup,
authentication, uploads, AI or search.

## Validation

The offline production image build, TypeScript check, scoped lint, full
phase-1 verifier, separate development boot and standalone browser checks are
required. The full verifier retains all thirteen preceding groups, including
eight PG15/PG18 × public/extensions × 768/3072 cases, generated DDL/type
agreement, transaction-mode PgBouncer, rollback/concurrent boot, verified TLS,
API/CORS/persistence/secrets/pools, fatal bounds and cleanup.

The [final local run](2026-10-21-p02-review-verification.json),
`p02-1792576014416-a7c4e7b5`, passed all thirteen groups, including cleanup,
on the submitted code revision `bd4f2f94e59e6b9d11eb4d97bf4ecfe8301ce12e`.
The separate development smoke and browser checks also passed. Scoped lint
covered 200 files; the structural scan covered 410 files. The final image
records that explicit source commit; the verifier matched both its source
fingerprint and commit against the checkout.

Docker Desktop stopped between the earlier run and final verification. After
the operator repaired it, the submitted source was rebuilt and the complete
verifier rerun successfully. The old browser containers were absent on the
restored engine; their empty, identity-checked network was removed. The final
verifier also removed all its owned resources. No operator database or dotenv
files were used.

[GitHub CI](https://github.com/feedbackland/feedbackland/actions/runs/39577866481)
passed foundations and development boot at the submitted code revision;
[Vercel](https://vercel.com/feedbackland-org/feedbackland/5Du7JafR7fVMSQb26R5hReghZ3sV)
also succeeded. This evidence-only follow-up does not change application code.

CI rebuilds the actual submitted checkout with an explicit commit identity
and reruns every group. Require green checks on the follow-up PR's final
revision and independent review before merge. P03 is the next milestone.
