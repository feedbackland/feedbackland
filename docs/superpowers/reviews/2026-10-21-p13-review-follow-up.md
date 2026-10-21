# PR #13 adversarial review follow-up

The second review of PR #13 at `da1ffbe532e3b0868a5cb048f5bdb50cc07e513f`
identified four additional P2 defects. This follow-up retains the original
six P02 fixes and resolves all four additional findings.

| Finding | Resolution | Regression |
|---|---|---|
| An unrelated settings save erased another editor's draft | Track each field's dirty state and original value/revision. Rebase a dirty draft only when that field's server value is unchanged. Same-field changes preserve the draft and original CAS revision, producing an explicit conflict. Cancel resets from the latest snapshot and never submits. | Chromium runs both production forms, the private-query hook and mutation/cache stack: both draft/save directions, successful rebased saves, conflicts in both fields, cancellation and reopening. |
| A committed settings save followed by a failed refetch retained a stale revision | Return the same explicit six-field private projection as `getSettings`. Cancel older reads, cache the committed snapshot using an exact bigint revision comparison, then refetch. Optional broadcast failures cannot change the save result. | The actual mutation hook and active QueryObserver cover a read outage, the next save, a late old read, an older mutation response and revisions above the JavaScript safe integer limit. Chromium also saves again after a failed refetch and displays canonical server trimming. Adapter/SQL checks verify the response projection and committed values. |
| Valid maximum-length posts could not be edited | Keep the 10,000 raw UTF-16-unit create bound. Post edits accept 128,000 UTF-8 HTML bytes and at most 10,000 decoded text units, counting each `br` as one newline. Entity expansion and paragraph wrapping no longer consume the text budget. The legacy HTML API/comment byte bound remains 48,000. | Actual adapter/database create → title-only edit → paragraph-wrapped edit for maximum ampersands, angle brackets, newlines and emoji, plus literal markup. Reject decoded overlength, excessive bytes (including multibyte input), media and deeply nested HTML. |
| Normalization-empty content created blank records | Require a nonempty normalized plain-text result before insertion. | Zero-width-only and whitespace/zero-width mixtures return HTTP 400 and leave the feedback row count unchanged. |

HTML tree traversal is iterative and caps sanitized nesting at 100 before the
recursive plain-text converter runs. This also protects legacy text writes;
their byte limit and media restrictions remain enforced. The HTML budget is
independent of decoded text and is not an unlimited rich-text allowance.

The browser fixture replaces only the in-memory transport, admin identity and
router navigation. It runs the production settings components and both hooks;
it does not add a production authentication switch. Separate real fetch-adapter
and PostgreSQL tests enforce server contracts. Public privileged HTTP remains
closed until P04.

The pinned Playwright test dependency is brought forward from P03 so these UI
regressions are mandatory in phase 1. CI installs Chromium. The cumulative
phase-1 verifier adds one browser group and retains every preceding group.
The caller inventory is regenerated for the shared private-settings projection.
No database migration is required.

## Validation

TypeScript, scoped lint, focused cache/browser regressions, the offline
production image build and the separate development smoke passed locally.
Final run `p02-1792591254917-a06c32e5` passed all **14** cumulative groups,
including every SQL/adapter regression in all eight database combinations and
both cleanup groups. The [machine-readable report](2026-10-21-p13-review-follow-up-verification.json)
records image `sha256:fd72458c4ae5b1674be5ad0a7b27121b7fa31c35026c000937b40a6a730e74d0`
and source tree `5090c510357f9b2f6f2b9af8ef7847a9d1d0c860f427b93be4593b20079fa851`.
Local images omit `SOURCE_COMMIT`; the verified production
source-tree fingerprint identifies the tested inputs. CI rebuilds the submitted
checkout with an explicit commit identity. Tests use only disposable fixture
databases and no operator dotenv files.

The initial cumulative attempt ended when a Windows Node database worker
exited with native code `3221226505`, without a JavaScript assertion or stack.
Its cleanup passed. The complete worker then passed on fresh PG15 and PG18
fixtures, and the full cumulative rerun above passed. The native exit's cause
was not established; no gate was skipped or weakened to obtain the passing run.

PR #14 depends on #13 and must retain these fixes with its P03 isolation changes.
Merge #13 before #14 after independent review. P04 is outside this follow-up.
