# P12 phase-6 integration evidence

The automated candidate is stacked on [P11 / PR #22](https://github.com/feedbackland/feedbackland/pull/22) at `7a5dda720872bb5f0a39f0d3b884466d631e3376`. P04–P11 are still stacked above [PR #10](https://github.com/feedbackland/feedbackland/pull/10). The phase-6 integration merge requires the reviewed stack, the manual evidence below, P00, and release-owner authorization.

## Automated verification

```powershell
$env:SOURCE_COMMIT = git rev-parse HEAD
docker build --build-arg "SOURCE_COMMIT=$env:SOURCE_COMMIT" --tag feedbackland:ci .
npm run verify -- --phase 6 --image feedbackland:ci --artifacts artifacts/self-hosting
```

GitHub Actions runs the cumulative gate on the PR merge checkout, produces `self-hosting-phase-6`, and reports the exact image ID, source commit, build identity and results in `summary.json`. The summary lists separate operator evidence. The [P11 baseline run](https://github.com/feedbackland/feedbackland/actions/runs/44142251866) passed 41 groups. Phase 6 adds two named groups and extends the existing AI group.

- **V2/V11/V16 keyless primary flow and observed egress.** The image runs on a private Docker bridge behind Caddy. Setup, Activity, AI settings, Ask AI, an attachment, post/comment edits, upvote, exact pagination on both surfaces, and real cross-site widget submissions use the disposable instance. All three AI endpoints report `AI_NOT_CONFIGURED`. The system-call reader keeps only endpoint classes and counts, and the independent DNS logger records lookup names. Positive controls use `observer-control.invalid` and TEST-NET-1 inside the private bridge. Resolver setup and tracing exist only in the test.
- **V23 independent fixtures and maximum model request shapes.** The selection corpus contains 20 allow and 20 refuse examples. Twenty accepted examples also have expected title categories. The held-out corpus contains 40 allow and 40 refuse examples spanning ten languages, including criticism, instruction-like content, obfuscation, image screening, and text-only fallback. The separate search corpus has ten related and ten unrelated pairs. The gate checks schemas, duplicate inputs, media, hashes, maximum UTF-8 inputs, image sizes, tokenizer, split retry counts and known or unknown prices.
- **V8/V11/V12/V13/V20/V21 OpenRouter, content, durable search and background insights.** The phase-6 extension submits an authenticated browser question, renders a source citation, verifies the actual cache breakpoint and usage on the wire, injects reflected provider failures, scans persisted output and logs, and repeats the main board journey with the provider configured. The production HTTP fixture verifies declared and assembled request bounds, authorization, per-user, instance and daily limits.
- **V18/V21/V23 AI onboarding, concurrent configuration and mounted status.** The cumulative suite retains the timing, closed-page credit, backfill, provider recovery, two-replica, and mounted UTC allowance checks from P11.

## Review closure ledger

“Automated” means the listed phase-6 gate owns the corresponding assertions. The candidate run controls their observed status. Rows with additional obligations record those separately. Gate names below match the JSON evidence, with “AI integration” and “onboarding” referring to the two grouped gates listed above.

| Item | Phase-6 automated evidence | Additional evidence |
|---|---|---|
| F01 | `auth/setup-credentials-authorization-matrix`; AI integration rechecks role before the final content write and checks Ask AI authorization | |
| F02 | `surface/drawer-navigation-isolation-clipboard`; `auth/browser-chromium`, `auth/browser-firefox`, `auth/browser-webkit` | |
| F03 | `tls/policies-chain-hostname-expiry`; `boot/failure-pooler-concurrency` | P13 target smoke against an external TLS database |
| F04 | `images/container-framing-deadlines`; `images/production-streams-rss-and-slot-recovery` | |
| F05 | AI integration production vision admission, cancellation, and cgroup memory bound | |
| F06 | | P13 new-volume PostgreSQL major upgrade, restore and rollback |
| F07 | AI integration includes transport, content, report, Ask AI stream and stored-state scans; onboarding includes metadata and connection output | |
| F08 | AI integration durable-search maintenance with no verified index; onboarding automatic credit after the browser closes | |
| F09 | AI integration search replicas retain running peer across index rebuild | |
| F10 | AI integration real vector topology, ordered and materialized traversal | |
| F11 | AI integration durable cursor expiry, replica pagination, outage, and rebuild | |
| F12 | `client/settings-drafts-and-revisions`; AI integration content/vector/search fences; onboarding concurrent settings actions | |
| F13 | `images/attach-logo-delete-reclaim-sweep`; `images/two-replica-quota` | |
| F14 | AI integration fenced insight runs, one owner, and obsolete publication refusal | |
| F15 | AI integration insight reservation against actual chunk/merge calls and UTC day checks | |
| F16 | `V23 independent fixtures and maximum model request shapes`; AI integration and onboarding budgets, retries and usage | Dated paid metrics and price snapshot |
| F17 | AI integration same-suffix credential change; onboarding revision, stale checks and replacement receipts | |
| F18 | `client/settings-drafts-and-revisions`; onboarding mounted tabs, drawer and UTC transition | |
| F19 | `backup/restore-same_schema`; `backup/restore-relocated` | P13 full restore bundle with preserved and rotated secrets; P15 clean target |
| F20 | | P13 scheduled backup failure, rename, dump integrity and retention |
| F21 | `image/identity/filesystem`; `surface/drawer-navigation-isolation-clipboard`; onboarding two replicas | P13 native image child manifests, stopped/restarted open forms; P15 observed target cutover |
| F22 | AI integration shared tokenizer, bounded multilingual text and backfill | |
| F23 | `schema/pg15-pg18-dimensions-ddl-types`; AI integration rejection before model dispatch | |
| F24 | `social/recovery-reset-handoff-contracts`; `social/inferred-origin-and-operator-recovery` | |
| F25 | `social/two-replica-discovery`; `social/discovery-cancellation-and-retention` | Real Google/Microsoft device checks at release |
| F26 | `static/removal-configuration`; `static/import-boundaries` | V6 hosted-retirement surface checks at P17 |
| F27 | `auth/setup-credentials-authorization-matrix`; `social/recovery-reset-handoff-contracts` | P15 platform secret generation |
| F28 | AI integration insight renewal, stall/death, takeover and obsolete owner rejection | |
| F29 | `social/recovery-reset-handoff-contracts` identity/avatar handling | |
| A01 | AI integration moderation lifecycle, history, edits and expiry | |
| A02 | AI integration exact tier with partial indexing and rejected vectors | |
| A03 | AI integration ordered health and onboarding stale key/enable/Keep AI off paths | |
| A04 | `images/attach-logo-delete-reclaim-sweep`; `images/primary-browser-flow` System action; onboarding status | |
| A05 | `images/public-cache-exif-and-authorization`; `images/container-framing-deadlines` | |
| A06 | `V2/V11/V16 keyless primary flow and observed egress` | |
| A07 | `V23 independent fixtures and maximum model request shapes` | Review the held-out labels and record the paid selection and validation run |
| A08 | `backup/restore-same_schema`; `backup/restore-relocated` | P13 encrypted off-host drill, retention, RPO and RTO; P15 target records |
| A09 | `compose/runtime-invariants`; `direct-image/port-hostname` | P13 actual platform PORT behavior |
| A10 | Onboarding state/path/admin/mode binding | Dated real OpenRouter Connect and key paste |
| A11 | `schema/pg15-pg18-dimensions-ddl-types` | P13 release-date upstream PG support-policy check |
| A12 | P00 local isolation recorded in the [foundations evidence](2026-10-18-p01-foundations-evidence.md) | P00 external record; P17 dated notice, exports, revocations and continuing ownership |

## Authenticated OpenRouter measurement

Use a new inference key with a finite, non-resetting USD spend cap on a funded fixture-only account. Choose the budget and the maximum requests/candidates before starting. Keep the key in the launching shell's environment using the operator's secret manager. The command uses only the committed synthetic examples and writes its dated result under ignored `artifacts/self-hosting/live-ai/`. The report includes fixture and prompt hashes, actual provider tokens/costs when provided, mismatch IDs, served model, privacy mode, 768-wide embedding results, pair distances, and the proposed default and price snapshot. Review its output before committing an evidence summary.

```text
npm run measure:ai -- --manifest-only
npm run measure:ai -- --max-usd <USD> --max-requests <count> --max-candidates <count>
```

Try priced models in increasing catalogue order for the reference workload recorded by the script. A passing candidate needs every selection verdict, all twenty valid titles and categories, and approval of their proposed headings. Freeze the held-out cases before opening the report. A held-out mismatch blocks selection and calls for reviewing the change and a newly reviewed validation set. A differing default or distance cutoff requires applying and verifying the measured choices before phase-6 closure. Report unpriced calls as unknown and leave the release-time price snapshot pending when the provider omits needed cost fields. Keep the current defaults provisional until this run exists.

## Live Connect and operator record

Record a UTC date, exact artifact and browser versions, the expected versus observed result, and a sanitized evidence reference for each case. Use a disposable domain, instance and provider keys. Public redirect attribution exposes the callback board address, so use a domain approved for listing. Keep callback codes, full key identifiers, screenshots of account details and customer data private.

| V18 case | Required observation | Status |
|---|---|---|
| HTTPS redirect with funded existing account | Browser returns to the matched admin flow, confirms ownership, and both checks pass. Record what the public callback lists and whether the requested key limit appears at OpenRouter. | Pending operator run |
| Newly created account | Staged credit status, actual funding, then AI enables without another key or click. Record timing and the provider's metadata. | Pending operator run |
| Localhost redirect | Chromium, Firefox and WebKit complete using the provider's actual redirect and returned verifier challenge. | Pending operator run |
| LAN headless | No callback listing, copy/paste once, confirm ownership and verify board availability. | Pending operator run |
| Paste | A separately created real inference key connects and can be removed without revoking another key. | Pending operator run |
| PKCE and attribution observations | Record whether the provider rejects a verifier on a challenge-less code, and whether localhost and headless flows leave public attribution absent. Use only newly created disposable codes. | Pending operator run |

The P00 record still requires primary and backup owner names, evidence of hosted Git deploy disconnection, npm email/2FA and domain continuity, actual notice/freeze/export/shutdown dates, and private credential/export handling. The existing Vercel PR check is evidence the hosted Git integration was still responding to branch pushes during this work. P00, the paid model/default decision, live Connect, and stack integration remain open.
