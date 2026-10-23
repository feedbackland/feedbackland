# Self-hosted design: revision 4 disposition

Date: 2026-10-18. Scope: revise the design in response to **every** recommendation
in the [adversarial review](2026-10-18-self-hosted-single-tenant-review.md).
The [revised plan](../specs/2026-09-13-self-hosted-single-tenant-design.md) is the
normative specification. The original review and its defect reproductions are
preserved as historical evidence against revision 3.2.

All **29 findings and 12 additional recommendations** have a concrete design
disposition below. “Addressed in design” does not mean implemented, integrated,
deployed, or safe to release. No application implementation or external hosted
retirement action was performed in this revision. The plan's status, evidence
language, schema, affected files, phases, risks and verification obligations
now reflect that distinction.

| ID | Addressed in the normative plan | Owning phase / required proof |
|---|---|---|
| F01 | §3 `canAdminister` requires role, first-party scope and absolute session age; all four author-or-admin update/delete queries use it. Final transactions recheck authority after model work. Invite redemption explicitly requires a fresh first-party session. Author rights remain available. | 3; V19 bearer/cookie replay, aged sessions, own/other content, delayed revocation and embedded invites |
| F02 | §2 root no longer owns auth/tRPC. Board providers are below EmbedProvider; absent hints remain unresolved and block credential work. First-party routes have explicit independent providers; mode changes cancel work and discard caches. | 2–3; V19 first request, same-site admin cookie, proxy bypass, cross-site and remount isolation |
| F03 | §6 complete TLS selector table preserves ssl=true as verify-full; duplicate/conflicting selectors, unsupported URL certificate options and unsupported fallback fail before connect. CA-only means verified TLS; no silent discard/downgrade. | 1/7; V22 parser matrix and V10 negotiated encryption, trust and identity failures |
| F04 | §4 counts the entire request before multipart parsing, separately caps file bytes, restricts parts/fields/headers and enforces progress/wall deadlines with cancellation. Two process upload slots bound buffering. | 5; V20 chunked/lying length, huge fields/preambles/headers, extra parts, malformed/slow/incomplete/disconnected streams |
| F05 | §5 vision admission precedes bytea loading/encoding. One process vision job, explicit memory reservation, bounded bytes/pixels/images and no waiting queue. Local saturation returns busy without publishing; provider unavailability remains a separately stated policy. | 6a; V20 slow mock burst, cgroup memory, active HTTP count and cleanup/availability assertions |
| F06 | §8 major upgrade uses a new isolated volume and target-major restore/backup tools; preserves stopped source cluster and tests the first new scheduled backup. Shared-volume automatic initialization is explicitly forbidden. | 7; V22 real 17→18 transition, third-target restore and pre-write rollback |
| F07 | §5 errors map only numeric status, fixed internal reason, feature and random id. Provider messages, causes/stacks, validation data and arbitrary provider fields cannot escape into any output sink; bounded response readers and catch boundaries apply. | 6a; V20 reflected prompt/email/key markers across JSON, streams, logs, responses, health and report errors |
| F08 | §6 maintenance leadership is acquired independently of embedding eligibility. Credit/health due work precedes backfill; fresh unpaid/no-embedding installs can complete onboarding with the tab closed, subject to explicit budget availability. | 6; V21 unpaid key/no prior lease, model none and failed width probe |
| F09 | §5 durable indexEpoch changes atomically with fingerprint/physical type. Every replica synchronizes both column widths on epoch change and checks before operations; stale work is fenced. | 6a; V21 A rebuilds 768→1536 while B remains running |
| F10 | §5/§6 collect strict-order bounded ANN candidates and materialize one sorted result snapshot. Page reads use ordinal positions, never a relaxed-order distance cursor. Approximate recall and result caps are explicit. | 6a; V8/V21 varied vectors, ties, filters and complete captured-candidate traversal |
| F11 | §5 durable capability-bound search sessions store mode, filters, owner, generation, vector and ordered ids. Cross-replica pages require no new model call. Outage/budget changes cannot reinterpret an existing cursor; expiry/rebuild requires explicit restart. | 6a; V21 alternating replicas, outage/cap change, deletion, expiry, rebuild and capacity |
| F12 | §5/§6 content, board-settings and AI-settings CAS use SQL-incremented bigint revisions serialized as decimal strings. Timestamps are display/expiry data only. Embeddings carry content revision and index epoch. | 1/6; V21 same-millisecond races and out-of-order completion |
| F13 | §4 all image ownership/quota mutations use one transaction-scoped lock and documented lock order. Check and insert/reference transitions are atomic; detaching cannot silently exceed pending quota. | 5; V20 multiple clients/replicas near both caps, reference/logo/delete/reclaim/sweep races |
| F14 | §5/§6 insight start is serialized and structurally constrained to one running row. Lease owner/fence guards heartbeat/final publication; save updates that run id atomically with derived insights. | 6a; V21 concurrent starts, admission failure, worker death and stale completion |
| F15 | §5 freezes a request plan including all chunks and final merge. Reservation and run admission commit together; no insight retry wrapper. Midnight expiry, unused reservation and conservative non-refund behavior are defined. | 6a; V21 near-80% multi-chunk admission and actual mock request count |
| F16 | §5 enforces per-feature assembled byte/history/image/output budgets and profile-specific embedding token limits. UI currency figures are labeled scenarios; unknown prices/tokenizers do not yield a claimed upper bound. Provider spend limit is the monetary control. Ordinary/diagnostic allowances and every retry are explicit. | 6; V21 maximum request shapes, all request accounting paths and price assumptions |
| F17 | §5 uses full-key digest plus resolved configuration/revision token internally; suffix is display only. Async results condition on captured revision/token and current enabled/wait state. Enable commits bind results to the replacement token. | 6b; V21 same-suffix replacement keys and delayed check/probe/credit results |
| F18 | §10 SSR settings are refreshed in mounted clients. Visible polling plus bounded server cache gives ten seconds plus network latency; focus/local hints refresh immediately. Private admin status has separate auth; stale/offline behavior and metadata limits are explicit. | 1/6b; V23 same DOM across saves, health/budget changes and live UTC rollover |
| F19 | §4/§8/§11 replace dump-completeness claims with a recovery bundle: DB plus protected configuration/secrets inventory. Preserve injected auth secret for AI decryption; intentional rotation revokes flows/sessions and reconnects AI. | 5/7; V22 fresh platform target, changed generated secret, OAuth/SMTP/AI and intentional rotation |
| F20 | §8 actual backup shell validates canonical bounded positive interval and keep count before any work. Invalid configuration exits once. Rotation requires successful dump and rename; ordinary failures wait the interval. | 7; V22 invalid/boundary values and dump/rename failures |
| F21 | §8 explicitly chooses the review's topology-restriction option: one immutable child digest and architecture per replica set, identifiable native artifacts and stop/start upgrades. Recreate/nodeSelector enforce the supported K8S topology. Public image action keys are not installation secrets; old forms/assets require a controlled reload. | 0/7; V23 child manifests/identities, alternating same-artifact form/RSC calls and open-client stop/start upgrade |
| F22 | §5 default embedding profiles use pinned cl100k_base with an 8,000-token input limit and token/byte batch caps. Shared preparation truncates all paths. Unknown tokenizer profiles disable embeddings with a diagnostic rather than silently skipping valid long rows. | 6a; V21 multilingual, emoji, combining marks, code and the demonstrated 8,999-token CJK case |
| F23 | §6 same-post composite reply FK plus preflight/final validation enforce parentage. Immutable parent/post, bounded depth and existing parents prohibit cycles through supported writes. | 1; V19 invalid parent before paid calls, raw FK rejection and unrelated post survival |
| F24 | §3 serializes admin membership and refuses the last-admin removal. §7 recovery-code authority explicitly repairs zero admins through an existing password identity; ordinary sign-up can establish one if needed. Claims serialize recovery and support interrupted reset/promotion. | 1/4; V19 mutual demotion; V22 deliberately zero-admin and interrupted/concurrent recovery |
| F25 | §3 durable discovery epoch plus periodic process-local reconstruction/retry propagates OIDC recovery. Discovery deadlines and captured per-request auth instances preserve password/callback behavior. | 4/6; V19 retry through A followed by status/social start through B |
| F26 | V6 exempts only exact AST literal nodes in the complete neutralization array; validates the deletion loop and rejects references elsewhere or computed evasions. No blanket config-file exception. | 1; V6 neutralization and vendor-residue checks run together |
| F27 | §7 platform defaults generate random codes; manual codes require 32 CSPRNG bytes (hex or canonical padded base64), obvious decoded weak patterns rejected. Render's documented base64 output is accepted without case-folding. Honest randomness/length distinction, constant-time decoding and consistent normalization replace the old entropy claim. | 3/4/7; V22 weak/malformed/random codes and V9 actual platform generation/UI |
| F28 | §6 awaited scheduler prevents overlapping ticks. Independent ten-second lease renewal, bounded reserved maintenance connection, database clock, monotone fences and abort on loss support requests beyond the lease TTL. Crash duplication is acknowledged and counted. | 6a; V21 >90-second request, holder death/stall, takeover and stale writes |
| F29 | §3 update hook treats omitted **or undefined** image as unchanged, rejects defined non-provider image changes, and permits trusted HTTPS provider updates. The exact package's name-only path was executed; checking own-property presence alone was insufficient. | 3/4; V19 avatar preservation and tracking URL rejection |

The additional recommendations are independent obligations, not hidden in the
finding count:

| ID | Addressed in the normative plan | Owning phase / required proof |
|---|---|---|
| A01 | §5/§6 current moderation state belongs to the content revision; historical events retain their revision/reason. Successful edits resolve current filtering, distinct surviving items define historical 24-hour counts, and old-event expiry cannot hide current unscreened items. | 1/6; V21 repeated edits, resolution, deletion, expiry and duplicate-free feed |
| A02 | §5 semantic sessions include a deterministic second exact-match tier for null/skipped vectors under identical filters; result caps/truncation are visible. | 6a; V21 partial backfill and partial write outages |
| A03 | §5 config-token/revision/enable guards discard obsolete results; per-capability health rows and dispatch sequences prevent JSON lost updates/out-of-order health regression. Passing enable transition rebinds the result atomically. | 6; V21 Keep AI off race and concurrent capability observations |
| A04 | §4 states pending-quota denial of service at default sizes and adds fresh-admin preview/confirmed reclaim under the same quota/reference lock. | 5; V20 attachment since preview, referenced/logo preservation and recovery of capacity |
| A05 | §4 states direct uploads may retain EXIF and metadata checks are not server raster decoding. GIF byte/canvas/frame/work/duration limits and bounded container parsing are explicit; only GIF animation is accepted. | 5; V20 direct EXIF and malformed/high-frame animation fixtures |
| A06 | V16 explicitly unsets optional external auth/mail configuration and observes both DNS and network syscall attempts, including failed literal-IP attempts, with a positive control. Egress blocking alone is insufficient. | 6; V16 before-start process-tree trace and DNS evidence |
| A07 | V23 separates model selection and independent held-out moderation validation, adds multilingual/adversarial cases, and independently tests maximum token/cost shapes. Fixture success is not a universal safety claim. | 6; V23 hashes, rationale, verdicts and dated paid validation evidence |
| A08 | §8 keep count is not days; local dumps do not cover host loss. Encrypted off-host bundle transfer/checksum and separate key custody are specified; nominal conditional RPO/RTO need a measured restore drill. | 7; V22 decrypt/off-host recovery, failure retention and measured timing |
| A09 | §8 Compose explicitly overrides PORT/HOSTNAME/NODE_ENV/telemetry/keepalive from env_file. Direct platform PORT support remains. | 0/7; V23 hostile/stale .env fixture, V10 direct-image/platform behavior |
| A10 | §5 and Appendix A now follow the current echoed-state OAuth contract, retaining path nonce/admin/verifier/revision binding and distinct headless handling. | 6b; V18/V23 missing/wrong state and real dated provider check |
| A11 | Summary/§8 distinguish legacy SQL compatibility from security support: production floor 15, upstream-supported majors only, full 15/18 integration matrix and release-time policy check. | 1/7; V1/V22 full real-vector matrix |
| A12 | §0 requires a retirement record with named primary/backup owners, dates, private export evidence, revocations and continuing domain/parking/payment/succession responsibility. No action is marked done by drafting the plan. | −1/9; V23 actual owner/date/evidence record |

Concrete choices that deliberately narrow earlier promises:

- Search is a bounded ten-minute result snapshot (up to 1,000 ids, fewer when
  payload limits require; legacy ANN tier up to 400). Restart is explicit on
  generation change/expiry; there is no per-query lifetime billing guarantee.
- Unknown embedding tokenizers need a reviewed profile. They do not inherit
  the default model's context assumptions from a successful one-string probe.
- Mixed-architecture or mixed-release rolling replica sets are outside v1
  support. A multi-architecture image manifest still supports installing on
  either architecture. Same-artifact replicas remain supported.
- Request accounting bounds attempted requests, including explicit retry
  admissions. Monetary scenarios are estimates; provider spend controls are
  separate. Closed-tab credit completion can wait when its allowance is spent.
- Lease fencing protects database results; a provider may charge a request
  whose worker died. Backfill takeover can therefore incur a counted duplicate.
- Raw upload metadata can survive. Partial image-screening coverage is visible
  rather than silently described as full moderation.

Validation actually executed for this revision:

- [Contract proof harness](2026-10-18-revision-4-contract-proofs.mjs) and
  [twelve passing result records](2026-10-18-revision-4-contract-results.jsonl).
  Runs used Node 24.15.0, PostgreSQL 17.5 on a dedicated loopback-only disposable
  cluster, better-auth 1.7.6, pg 8.23.0 and js-tiktoken 1.0.21. Only synthetic
  rows/identities/keys were used. The new random schemas were removed and the
  dedicated cluster stopped afterward.
- SQL checks cover integer CAS/stale vectors; ten mutual-demotion races;
  twenty concurrent quota contenders; twenty singleton insight starts plus
  unique-index rejection; cross-post parent rejection/deletion isolation;
  same-suffix key identities and delayed enable; expired-holder renewal fencing;
  and chunk-plus-merge reservation preserving the moderation share.
- The CJK fixture is 5,999 JS characters and 8,999 tokens; preparation fits
  8,000 tokens. Better Auth's real update route preserves the avatar on a
  name-only change and refuses a tracking-image update with the corrected hook.
  The **actual shell validation extracted from the plan** rejects ten invalid
  interval/retention pairs and accepts three boundary/normal pairs before
  entering a backup loop. A separate encoding-contract prototype verifies fresh
  32-byte secrets round-trip through uppercase/lowercase hex and canonical
  padded base64, rejects a noncanonical equivalent alias, and rejects five
  weak/malformed inputs. It is not an application validator integration test.
- The document was checked for stale superseded instructions, verification
  numbering/references, complete F01–F29/A01–A12 coverage, Markdown table/fence
  structure and whitespace errors. This is document consistency evidence.

These are small package/SQL contract experiments, not endpoint, multi-process,
container or deployment proofs. The broader V19–V23 tests are specified future
implementation gates. No Docker daemon was available for image/HNSW/memory/
major-upgrade tests; no real OpenRouter charge, cloud deployment, OAuth account
change, npm publish/deprecation or hosted retirement was performed. Public
documentation checks are dated and linked in the plan's evidence appendix.

No review item is left without a design disposition. Implementation acceptance
still requires the owning phase's complete committed gate against its exact
artifact; neither this matrix nor the twelve synthetic passes grants release
approval.
