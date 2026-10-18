# Adversarial review of the self-hosted single-tenant design

**Verdict: request changes.** The design is not ready to be treated as an approved, fully executable contract. I identified **29 actionable findings: 6 P1, 22 P2, and 1 P3**. Some are reproducible failures of specified algorithms; others are missing enforcement rules for invariants the document explicitly promises. The distinction is stated for each finding. An implementation could repair a specification gap, but doing so requires a decision the current document says the executor must not make.

**Scope and baseline.** Reviewed all 3,703 lines, including the delivery plan, all verification checks and both appendices, of [the design](../specs/2026-09-13-self-hosted-single-tenant-design.md), revision 3.2, at commit 4e905a50f37b94574552248e4ae49610785bfdd5 on single-tenant-self-hosting. Also traced the relevant current authorization, providers, database schema, query, image, search, insights, widget and release surfaces. The branch changes documentation; it does not contain the proposed application implementation. Consequently, findings describe defects or omissions in the plan, rather than claim to have exploited a completed replacement application.

**Evidence.** Used Node 24.15.0, the installed Next 16.3.5, pg 8.23.0 and current repository source; independently obtained the exact proposed better-auth 1.7.6, @ai-sdk/openai-compatible 3.0.48 and ai 7.0.99 packages in an isolated temporary dependency directory. Ran synthetic reproductions against a separate local PostgreSQL 17.5 cluster, without accessing the existing application database or real credentials. Upstream checks used primary documentation and source. [Reproduction script](2026-10-18-plan-review-proofs.mjs) and [recorded output](2026-10-18-plan-review-proof-results.jsonl) accompany this report. Docker Desktop's Linux engine was unavailable, so container, browser, cloud deploy and real-provider gates were not represented as executed.

P1 means a material security or availability defect to resolve before implementation/release. P2 means a correctness, operational or specification defect that should be resolved in the design and its gates. P3 is a narrower regression. These are not CVSS ratings.

**1. [P1] Apply session-scope authorization inside every author-or-admin operation.**

Plan L777–789 limits the explicitly named enforcement points to adminProcedure, /api/chat and server-side admin readers. However, edit and delete are ordinary userProcedure mutations. Their query functions independently authorize with role === 'admin' OR authorId === userId. See [delete-feedback-post](../../../queries/delete-feedback-post.ts#L29), [delete-comment](../../../queries/delete-comment.ts#L29), [update-feedback-post](../../../queries/update-feedback-post.ts#L42), and [update-comment](../../../queries/update-comment.ts#L39). Replacing the org membership lookup with the proposed user.role preserves this bypass unless the plan explicitly changes it. Hiding buttons does not authorize the mutations.

A signed embedded session belonging to an admin still has user.role = admin. The local Better Auth reproduction returned scope = embedded, the existing edit/delete predicate = true, and the proposed scoped-admin predicate = false. A stolen drawer token would therefore retain the ability to modify/delete other people's content through these user procedures. The same omission lets an older-than-seven-days first-party admin session use the role-only override.

**Required change:** pass an effective, server-computed canAdminister capability into all author-or-admin queries, or evaluate the complete helper at their admin override. Preserve normal authorship permissions. Explicitly require first-party scope for invite redemption as promised at L968. **Gate:** an embedded admin token, replayed as bearer and cookie, and an aged first-party admin session must fail edits/deletions of another user's content while normal author edits continue to succeed. V7 currently tests admin procedures and chat, which misses these paths.

**2. [P1] Resolve the embed surface before mounting credential-bearing providers.**

Plan L760–774 selects the credential mode by useIsDrawerEmbed, but the retained component tree places [TRPCClientProvider and AuthProvider in the root layout](../../../app/layout.tsx#L93), above [EmbedProvider in the board layout](../../../app/[orgSubdomain]/(board)/layout.tsx:19). Ancestors cannot consume a descendant's React context. The surfaces-to-change table rewrites the auth hook and tRPC provider but never specifies the necessary provider restructuring or an independent synchronous surface resolver.

There is a second problem even after moving the providers: L375–380 accepts a missing proxy as cosmetic, while EmbedProvider initially reports null and only discovers drawer mode in an effect. Treating that unresolved value as first-party can issue the first get-session/tRPC request with cookies before the correction. On a same-site embedding host that can expose/use the board's first-party session, precisely the behavior L773 intends to prevent.

**Required change:** specify the provider tree and a distinct unresolved surface state. No request may select cookie authentication until the surface is positively known to be first-party. Pages outside the board group need their own explicit first-party provider placement. **Gate:** record every request from initial document hydration through sign-out, both with proxy headers and with the proxy bypassed, on same-site and cross-site hosts. Verify credentials omission from the first client request, not just the settled UI.

**3. [P1] Do not silently turn an explicit TLS connection request into plaintext.**

Plan L2172–2187 removes ssl and other SSL URL parameters, then chooses no TLS when sslmode is absent. A valid node-postgres URL ending in ?ssl=true therefore goes from TLS enabled to TLS disabled. The local reproduction showed originalTls = true and specifiedTls = false. A server that permits both can then receive database traffic over plaintext; a server requiring encryption instead becomes unreachable.

The instruction also drops sslrootcert and client certificate parameters without requiring an explicit error or equivalent configuration. In particular, the later claim of libpq semantics cannot justify ignoring security-relevant combinations of parameters.

**Required change:** define a complete, fail-safe precedence/parser policy. Map supported TLS aliases to their intended behavior; reject conflicting or unsupported certificate options with a named configuration error. An explicit encryption/verification request must never become a weaker connection silently. **Gate:** include ssl=true, ssl=1, certificate parameters and conflicting settings, asserting the negotiated security properties, rather than only that a connection succeeds.

**4. [P1] Bound the entire multipart stream, including its framing and rejected parts.**

Plan L1120–1124 checks declared Content-Length and counts bytes in the file part. For a chunked request without Content-Length, this does not bound the multipart preamble, headers, ordinary fields, unexpected parts or trailing data. A per-file cap is not an overall request cap. A parser can buffer a huge field/header or continue consuming an arbitrarily long malformed request before finding the one allowed file. The V7 example using a 50 MB body is insufficient if it exercises only a large file with a declared size.

**Required change:** put a counting, cancellable cap around the complete request stream before the multipart parser; also specify part-count, field-count, field/header-size and read-deadline limits, and abort the underlying read on rejection. **Gate:** chunked requests with no Content-Length, a small file plus a huge field, huge preamble/header, multiple files, incomplete boundaries and slow delivery. Assert bounded bytes, memory and completion time.

**5. [P1] Bound concurrent vision moderation before loading image bytes.**

Plan L1370 allows four images of up to 4,000,000 bytes to be loaded and base64-inlined for one moderation request. That is 16 MB of raw data plus about 21.3 MB of base64, before JSON encoding, SDK conversions, object overhead and the application itself. The posting limits admit bursts, and calls can remain active for 15 seconds. No concurrency or aggregate in-flight-byte admission rule is specified. A visitor can reuse public image IDs in many posts; the upload rate is not an effective bound on simultaneous moderation memory.

The advertised 512 MB app allocation can therefore be exhausted by a small allowed burst. Even 15 concurrent requests account for roughly 560 MB for just raw bytes and one base64 copy. V7's inbound body-size test does not cover this server-generated expansion, and V2's ordinary flow is not a concurrency stress test. This is a calculated exposure, not a measured container OOM in this review.

**Required change:** choose bounded per-process concurrency and an in-flight image-byte budget before database loading/encoding, with explicit overload behavior that cannot silently bypass moderation. Propagate cancellation. **Gate:** simultaneous image-heavy posts against a deliberately slow mock under the actual memory limit, including repeated references to the same images.

**6. [P1] Replace the PostgreSQL major-upgrade procedure with one the image will execute.**

Plan L2791 says that changing the image major will initialize 19/docker beside an existing 18/docker cluster in the same volume. The upstream entrypoint explicitly scans /var/lib/postgresql/*/docker for old PG_VERSION files when the new PGDATA is empty, and exits before initdb if it finds one. The proposed command sequence will not reach the restore step. This behavior is inherited by pgvector's image. See [Postgres image entrypoint](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh) and [pgvector Dockerfile](https://github.com/pgvector/pgvector/blob/master/Dockerfile).

Changing only db.image also leaves the backup service pinned to pg18. After an upgrade to a newer server major, that older pg_dump refuses to back it up.

**Required change:** specify either a new target volume/cluster with dump-and-restore or a tested pg_upgrade procedure, preserving the old cluster until acceptance. Stop all app writers, coordinate the backup client major and verify restore before retiring the source. **Gate:** a real major transition with the original volume present, followed by a successful scheduled backup of the upgraded server and a rollback drill. V4 currently tests restore, not this transition.

**7. [P2] Logging status plus error.message still leaks provider-reflected content.**

Plan L1330–1336 and L1537 promise no logged key or user content, but prescribe logging status and message. The exact proposed compatible SDK derives APICallError.message from the provider's error.message. A provider can echo input, personal data or sensitive request details in that string. A synthetic 401 with a private marker in error.message reached the proposed status/message logger unchanged in the local streamText test.

**Required change:** log allowlisted internal reason codes and numeric status, rather than provider-controlled messages. Apply the same rule to thrown errors, validation errors, insight job error fields and the shared logger. **Gate:** synthetic errors that echo the complete prompt, key-shaped values and emails in both structured and unstructured bodies; assert absence across all logs and responses. A mock 401 with a harmless canned message does not establish the guarantee.

**8. [P2] Give credit waiting and health recovery a leader even when embeddings cannot run.**

Plan L2203–2206 takes/renews the embedding-backfill lease only on the branch where embeddings are verified and the fingerprint matches. It then assigns credit polls and health checks to that same lease holder. A fresh, stored key awaiting credit has enabled IS NULL, AI is not configured, and no verified embeddings. A failed/unverified embedding probe or an intentionally disabled embedding model can produce the same absence of an eligible holder.

Following the specified branches literally leaves no leader to run the closed-tab credit check, so AI does not turn on automatically after credit arrives. The document needs an independent leadership path; merely saying that the check uses the same holder leaves the cold-start state unsatisfied.

**Required change:** acquire a housekeeping/AI-maintenance lease independently of backfill eligibility, then dispatch credit, health and backfill tasks separately. **Gate:** close the page immediately after the first unpaid connection, with no pre-existing lease or verified index; add credit and assert automatic enablement. Repeat with embeddingModel = none and with the probe failing.

**9. [P2] Refresh index dimensions in every replica after a rebuild.**

Plan L1414–1418 reads the physical width at boot and after a rebuild, and L2086–2091 holds it in process-local runtime state. The five-second configuration cache refreshes stored AI settings, but no rule makes another replica reread pg_attribute after a remote dimension-changing rebuild. indexFingerprint now says 1,536 while replica B's physical-width cache still says 768. B can keep requesting the old width or disabling semantic search because the fingerprint no longer matches. Re-probing with its unchanged cached width does not resolve the mismatch.

**Required change:** make an index-generation change invalidate the width and query-vector cache on every process and reread committed physical metadata before admitting any embedding work/search. **Gate:** rebuild on A while B stays running; both replicas must send the new dimension and serve search after the stated propagation bound. V18 tests the rebuild and another replica's key updates separately, which does not cover this case.

**10. [P2] Relaxed HNSW ordering is incompatible with the specified distance cursor.**

Plan L2013–2020 mandates hnsw.iterative_scan = relaxed_order. The board pagination predicate advances past the last returned distance/id. Relaxed scans can return a smaller distance after a larger one, so that cursor can permanently skip or repeat results across pages. An additional id tie-break does not restore global distance order if the planner trusts the index's distance ordering. [pgvector's documentation](https://github.com/pgvector/pgvector#iterative-index-scans) distinguishes strict ordering and gives an outer re-sort for relaxed results.

**Required change:** use strict_order for this cursor contract, or specify a correctly materialized/re-sorted candidate query and define its pagination behavior. **Gate:** many non-identical, realistic-dimensional vectors with varied distances; assert monotonic (distance,id) order and no duplicates/missing rows across pages. The 45-identical-post V8 fixture has tied distances and cannot detect the defect.

**11. [P2] Bind pagination to search mode and index generation.**

Plan L1402–1407 switches between semantic and ILIKE ordering per request. The current cursor carries fields for multiple sorts but no search mode or index identity. If page one is ordered by distance and page two falls back after a budget/provider/rate-limit event, the second request interprets a distance-ordered boundary as a newest/upvotes/comments boundary. On recovery it can switch back again. An intervening rebuild/model change similarly changes the meaning of the distance. A ten-minute, process-local query-vector cache does not stabilize a paginated search across replicas or cache expiry; the unconditional one-call claim at L1865 also fails when pages reach different processes.

**Required change:** put search mode, normalized-query identity and fingerprint/generation in the cursor or a search-session record. On a required mode/generation change, restart explicitly rather than silently reinterpret the cursor. State the actual caching guarantee. **Gate:** outages, budget exhaustion, rebuilds, cache expiry and alternating replicas between pages, alongside the existing steady-state tests.

**12. [P2] Millisecond timestamps are not revision tokens.**

Plan L1456, L1471 and L1954 uses timestamptz(3) equality to reject stale vectors and stale settings saves. Two distinct edits can legitimately have the same millisecond value. Local runs produced repeated collisions in 100 pairs of ordinary consecutive updates; the exact count is in the recorded output. A stale vector then passed the specified predicate and was written onto newer text. Separately, now() is fixed at transaction start: an older transaction that commits later can move updatedAt backwards, also reproduced locally.

**Required change:** use an incrementing integer revision or another unique per-write version for post/comment embedding writes and AI-settings compare-and-swap. Keep timestamps for display. **Gate:** same-millisecond edits/saves, interleaved commits and an in-flight embedding from the overwritten revision. The existing check that a deliberately older timestamp fails is insufficient.

**13. [P2] Define atomic enforcement of both image-storage quotas.**

Plan L1130 checks the sum and then stores the image, but specifies no lock, serializable retry, counter or reservation shared by concurrent uploaders. The schema has no quota-enforcing structure. Even putting a SUM and INSERT in ordinary READ COMMITTED transactions lets both uploads see the same available space. The local two-transaction reproduction admitted 11 bytes under a 10-byte cap. Total and pending quota both need a concurrency rule, and attaching/deleting references changes pending usage too.

**Required change:** choose one serialization/reservation protocol covering upload, attachment, logo changes and deletion; make its behavior explicit. **Gate:** parallel uploads immediately below each cap on different replicas, including concurrent reference changes, asserting that committed usage never exceeds the ceiling. This is an omitted enforcement decision, not a claim that every possible future implementation must race.

**14. [P2] Enforce the single running insights job in the database.**

Plan L1490–1492 promises that starting during a run returns the existing id, but L1950 and L1968 define no unique running-job constraint or start lock. Two requests/replicas can both observe no run and insert one. The local reproduction produced two running rows. Each job can spend its own reservation and concurrently update the same persisted insights.

**Required change:** specify atomic creation, for example a partial unique singleton constraint with conflict handling, plus ownership/fencing of completion after a run has been declared failed. Update the original report row rather than inadvertently retaining the old saveInsights insert-another-report behavior. **Gate:** concurrent start requests on two replicas return one id and start one worker; a stale worker cannot publish over a replacement run.

**15. [P2] Reserve the insights merge call as well as the chunk calls.**

Plan L1823 reserves exactly the chunk count and makes chunk calls consume no further budget. The retained algorithm also calls mergeAcrossChunks when more than one chunk was analyzed; see [the caller](../../../trpc/generate-insights.ts#L663) and [the merge model call](../../../trpc/generate-insights.ts#L386). A two-chunk run therefore makes at least three HTTP requests, not two. The document does not remove the merge step. Its existing custom retry wrapper also needs an explicit disposition under the new no-retries rule.

**Required change:** enumerate and reserve every possible request, including merge and permitted explicit retries, or define per-request charging/refunds with a consistent admission policy. **Gate:** a multi-chunk run near the 80% boundary, with the mock counting actual HTTP requests. Assert that no request spends moderation's reserved share without being counted.

**16. [P2] The displayed worst-case dollar figure is not an established upper bound.**

Plan L1851–1855 treats Ask-AI's full corpus plus output cap as the largest possible request. It omits the client-supplied conversation, which the current route converts wholesale and the plan bounds only by a 1 MB body. The retained insights chunk can contain 200 descriptions of up to 700 characters, while Ask-AI contains 300 descriptions of 400 characters; image moderation has a different pricing basis again. Character counts also do not bound tokens uniformly. A sampled, typical fixture is not a proof that Ask-AI has the maximum possible bill.

**Required change:** define enforceable per-feature text/token, conversation-history and image budgets, then compute the maximum across actual request shapes, models and permitted retry/reservation behavior. If that cannot be established, label the displayed amount as a scenario estimate, not a worst case. **Gate:** maximum-length histories, multilingual inputs, image-heavy moderation, largest insight batches and every output cap, with recorded request sizes and price calculation inputs.

**17. [P2] Do not identify an API key by its last four characters.**

Plan L1311 uses last4 to decide whether lastCheck belongs to the current key, and L1441 hashes last4, models and width to decide when to re-probe. Distinct keys can share the same suffix; hashing that suffix does not add the missing identity. A rejected old key can therefore poison a replacement key's usability status, or a replacement can retain the old verification result. The local reproduction constructs different key-shaped strings with the same suffix and different full SHA-256 hashes.

**Required change:** use a full-key digest or an opaque key/configuration revision internally, reserving last4 for display. Bind asynchronous check/probe/health writes to that revision and discard results from a superseded configuration. **Gate:** two different keys with the same suffix, plus an old probe finishing after the new key's successful check.

**18. [P2] The server settings cache does not update already-open browsers.**

Plan L2990–3022 delivers capabilities through a layout context with no client fetch; only the admin saving ordinary settings calls router.refresh. Neither a five-second server cache nor a process probe updates that mounted context. Long-lived drawers can keep showing Improve my draft after AI is disabled or past budget, and can keep hiding it after AI is enabled or UTC rollover. Other admins' status/navigation and Keep AI off notices can also remain stale. Client navigation reuses layouts; see [Next's layout behavior](https://nextjs.org/docs/app/api-reference/file-conventions/layout).

**Required change:** define a bounded client refresh/status subscription or polling policy, including cross-tab saves, health changes and daily rollover; alternatively weaken the UI timing claims explicitly. **Gate:** keep the same drawer and second admin tab open without reload while another admin changes settings and while health/budget changes. Test the existing DOM rather than opening a new page for every assertion.

**19. [P2] Document and test restoration of secrets held outside Postgres.**

Plan L1765–1775 correctly says an injected auth secret is not in a dump and is needed to decrypt the AI key. L2834–2837 and L3070 nevertheless say a dump brings the board back whole, except avatars. On a fresh Render restore, generateValue produces a new BETTER_AUTH_SECRET; the restored AI key is unreadable. OAuth/SMTP settings and other environment configuration are also outside the dump. This does not prevent signing in again with a password, so V4's password check can pass while the restored installation is incomplete.

**Required change:** define the recovery bundle: database dump plus separately protected environment/secrets inventory, with an explicit policy for preserving or rotating the auth secret. Correct the completeness claim. **Gate:** restore an injected-secret installation onto a fresh target, preserving the original secret, then prove AI-key decryption and configured integrations; separately test the documented intentional-rotation path.

**20. [P2] Validate the backup interval before entering the loop.**

Plan L2425–2435 validates BACKUP_KEEP but not BACKUP_INTERVAL_HOURS. At zero, sleep 0 succeeds and the service dumps continuously. Retention can then replace all fourteen daily recovery points in seconds/minutes. A negative or malformed interval can also turn sleep/arithmetic failure into repeated work or a restart loop. L3189 does not specify a positive interval bound.

**Required change:** validate both variables as bounded positive integers before any dump, fail once with a named error, and make rotation explicitly conditional on successful dump/rename. **Gate:** zero, negative, non-integer and excessive values produce no dump/rotation; ordinary failures preserve the earlier recovery points and do not run a tight loop.

**21. [P2] Coordinate Next build identity across independently built architectures.**

Plan L2575–2578 builds amd64 and arm64 independently on native runners and combines them into one versioned manifest; L2844 says replicas are safe. Independent next build runs generate different build IDs and server-function encryption keys unless coordinated. A mixed-architecture deployment can serve a setup/recovery form from one build and submit it to the other, or alternate incompatible RSC build identities despite using the same release tag. Database locks do not address this layer. See [Next's multi-server guidance](https://nextjs.org/docs/app/guides/self-hosting).

**Required change:** define release-consistent build/deployment identity and server-action key handling, or explicitly require routing/architecture constraints that make this safe. Also state the asset/routing behavior during a rolling release; matching IDs alone does not route old assets to the right server. **Gate:** compare the two architecture artifacts' relevant manifests, and run a form/navigation test with requests deliberately alternating builds. V3 currently tests database migration compatibility, not frontend build compatibility.

**22. [P2] Truncate embeddings by tokens, not by a presumed character ratio.**

Plan L1471 claims that 24,000 characters fit the default model's 8,192-token input context. That is false for multilingual text and emoji, including inputs that pass the existing 10,000-character body cap. The accompanying cl100k_base test encodes 3,000 space-separated copies of U+9F98 as 5,999 JavaScript characters and 8,999 tokens. The backfill then treats the resulting input error as a poison row and permanently marks legitimate content skipped. Halving the batch does not shorten the offending item.

**Required change:** enforce the model's token limit with the appropriate tokenizer or a conservative byte/token bound and a defined truncation/chunking strategy, both for immediate writes and backfill. **Gate:** emoji, CJK, combining characters and code-heavy maximum-length posts. A long English fixture does not establish the input bound.

**23. [P2] Constrain a reply's parent to the same post.**

Plan L1946 retains separate postId and parentCommentId foreign keys. Neither those constraints nor the current [create-comment query](../../../queries/create-comment.ts#L42) establishes that the parent belongs to postId. Single tenancy removes a board boundary, but does not remove this post boundary. A reply stored under post B can point at a parent under post A, disappear from B's root/reply rendering, and be deleted when A is deleted. The local schema reproduction accepted that combination and deleted the unrelated post's comment through the parent cascade.

**Required change:** enforce same-post parentage in the write transaction and preferably structurally with an appropriate composite reference. Define allowed reply depth and prohibit cycles if parent changes are ever supported. **Gate:** cross-post parents and nonexistent parents are rejected without spending model calls; deleting one post leaves another post's valid comments intact.

**24. [P2] Prevent concurrent removal of every admin, and define recovery from zero admins.**

The plan promises terminal-free admin recovery at L2320–2336 but only resets an existing admin. The retained [delete-admin transaction](../../../queries/delete-admin.ts#L15) prevents self-removal, not mutual concurrent removal. A and B can both read themselves as admins, demote the other in different rows, and commit. The local reproduction left zero admins. setupCompletedAt remains set, and /recover rejects non-admin emails, so none of the proposed browser recovery routes can repair the state.

**Required change:** serialize admin membership changes and enforce at least one remaining administrator, or give recovery-code possession an explicitly designed way to restore the role. **Gate:** mutual demotion on two replicas and a deliberately seeded zero-admin state. SMTP password resets alone do not restore a missing role.

**25. [P2] Propagate OIDC discovery retry across replicas.**

Plan L904–909 memoizes discovery in the process-local auth instance and makes Retry replace only globalThis.__feedbackland.auth. Another replica that skipped the provider at startup keeps its old auth object indefinitely. After a retry on A, load-balanced users can still receive PROVIDER_NOT_FOUND from B, and each replica can expose a different provider list. The five-second AI settings refresh does not replace Better Auth's object.

**Required change:** specify a discovery retry/version signal and reconstruction in all processes, or an independent bounded retry in each process with a clear status model. **Gate:** start two replicas before the IdP, bring the IdP up, retry through A, then force both the UI capability read and social sign-in through B without restarting it.

**26. [P2] Remove the contradiction between V6 and required environment neutralization.**

Plan L740–745 requires lib/config.ts to name and delete VERCEL_URL; L3441–3445 scans lib with a case-insensitive pattern containing vercel and gives no exception for that required literal. A compliant neutralization list therefore fails V6. The local regex reproduction confirms that VERCEL_URL is rejected. Dynamically assembling the name to evade a grep would make the security rule worse, not satisfy the intent.

**Required change:** narrowly allow the exact neutralization constants/statement, preferably with an AST-aware rule that rejects actual vendor integration rather than all textual mentions. **Gate:** run the residue and neutralization checks together against the intended final config module. Do not weaken the whole config file's audit coverage to make this one case pass.

**27. [P2] A chosen code's length is not its brute-force strength.**

Plan L2301–2304 treats any normalized twelve-character chosen setup code as comparable to a generated sixty-bit code, and L2328 makes a similar assertion for twenty-character recovery codes. Repeated characters, common phrases and product-name-plus-digits codes satisfy those rules without having comparable entropy. The docs explicitly ask operators for something memorable. On direct HTTP installs the per-IP limiter is spoofable, and no global attempt control exists by deliberate policy, so the weak-code case is not bounded by the stated security argument.

**Required change:** make the default deployment form generate a random secret, require a documented random encoding/strength for operator-supplied codes, and reject obvious weak values or define an additional abuse control that does not permanently lock out the operator. Correct the claim equating character count with entropy. **Gate:** weak-but-long values are rejected or carry the explicitly chosen mitigation; generated codes retain the intended entropy after normalization.

**28. [P2] Make the backfill lease compatible with request duration and prevent overlapping ticks.**

Plan L2203–2206 uses a ninety-second lease while AI_TIMEOUT_MS is configurable. A permitted embedding request longer than ninety seconds can outlive its lease, allowing another replica to start the same work. No independent renewal, fencing or non-overlap rule is specified. Even at the default timeout, an asynchronous five-second interval can re-enter before its previous batch writes unless the loop explicitly awaits completion. The row generation guard prevents stale storage, but cannot undo duplicate paid HTTP requests.

**Required change:** specify a non-overlapping scheduler, renew the lease during work or bound the admitted operation duration below it, and fence work on ownership loss. **Gate:** a mock that holds embeddings beyond ninety seconds, a stalled/terminated holder and concurrent replicas; count HTTP requests and assert both bounded duplication behavior and eventual takeover.

**29. [P3] Preserve a provider avatar on a name-only update.**

Plan L1031 directs the user create/update hooks to null image unless the path is a provider callback. Better Auth updateUser passes name and image separately into its internal update. Applying the proposed update hook to a name-only request therefore sets the existing provider image to null. The local reproduction performed a name change and read back image = null. This conflicts with preserving provider avatars and makes the display-name editor erase a previously valid avatar.

**Required change:** distinguish absent image from an explicitly supplied image. For ordinary updates, omit an absent field and reject/ignore an attempted change; do not overwrite the stored value with null. **Gate:** a provider user changing only their name retains the avatar, while a caller-supplied tracking URL remains blocked.

**Additional decisions and verification weaknesses to resolve without counting them as separate defects.**

- The Unscreened filter needs explicit revision semantics. moderation_event has historical events, but no content revision or resolution state. Define what happens after a successful screened edit, repeat unscreened edits and deletions, and whether the twenty-four-hour figure counts distinct items or events. Avoid duplicating feed rows through a one-to-many join.
- Define treatment of null/skipped embeddings while semantic search is enabled. During backfill or a partial write outage, a successful query embedding can hide otherwise exact textual matches on unindexed rows. The current fallback conditions do not describe a mixed indexed/unindexed corpus policy.
- Health updates and credit-wait completion must condition on the current key/configuration revision and enabled state. A check started before Keep AI off must not turn AI back on afterward; an old failure must not overwrite a new configuration's passing state. Atomic field-level updates are also needed to avoid two replicas overwriting chat/embedding health in one JSON object.
- Pending-image limits deliberately let a small anonymous upload burst block further uploads until cleanup. At the defaults, fifty maximum-size unreferenced uploads fill the pending budget. State that operational tradeoff and provide an authenticated reclaim/review action or reserve, rather than leaving the operator waiting for the twenty-four-hour grace period.
- The raw upload endpoint does not re-encode images. Browser-side EXIF removal is a convenience, not a server guarantee for direct callers. Animated GIF limits bound bytes and canvas dimensions, not total decoded animation work. Documentation and adversarial fixtures should reflect those limits.
- The no-key DNS test should set all optional auth/mail integrations off explicitly; otherwise an intentionally configured OIDC provider is a legitimate external request. Conversely, an egress-blocked test passing does not prove the absence of attempts to literal IP addresses. Match the guarantee to observed attempts, not successful DNS alone.
- The cost and moderation fixtures need independent validation cases and adversarial/multilingual coverage. Choosing the cheapest model on the same forty verdicts used as the only acceptance test can overfit the selection. Do not present a perfect small fixture as a general moderation-quality guarantee.
- BACKUP_KEEP means a count, not a time guarantee, and same-host dumps do not survive loss of that host. State the recovery-point/recovery-time expectations and an off-host backup path. A successful pg_dump exit alone also does not replace a restore drill.
- The Compose env_file passes variables such as PORT and HOSTNAME even though the prose calls them image/platform settings. Explicitly override/reject them in the Compose path, or document the consequence clearly; PORT=8080 otherwise invalidates the fixed port mapping and healthcheck. The broad pass-through also makes the bootstrap neutralization list a critical maintenance surface.
- OpenRouter's current [OAuth documentation](https://openrouter.ai/docs/guides/overview/auth/oauth) now documents an echoed state parameter. The path-nonce design can remain valid, but the unconditional statement in Appendix A that no state exists is obsolete. Recheck dated external claims rather than preserving them as permanent prohibitions.
- PostgreSQL 13 is already end-of-life, and 14 reaches end-of-life in November 2026 according to the [upstream version policy](https://www.postgresql.org/support/versioning/). Separate a technically tested compatibility floor from the recommended, security-supported deployment floor.
- The retirement plan is necessarily a maintainer process. Its gates should record owner, notice date, shutdown date, export handling, credential revocation and the long-term domain/parking renewal owner. A successful one-time parking test does not fulfill an indefinite domain-security commitment by itself.

**Coverage of the whole design.**

| Area | Review result and remaining proof obligation |
|---|---|
| Summary, goals, non-goals, normative rules | The explicit reset, optional AI, no path mounting, no account-linking and deferred full CSP choices were treated as scope decisions. Findings concern contradictions with the guarantees that remain. |
| §0 hosted retirement | Reviewed ordering, npm/domain authority, parking/CORS and credential retirement. External actions were not taken. Record process ownership and dates. |
| §1 tenancy removal, URLs, rate limits | Traced the user-role migration, author/admin paths, public endpoints, shared rate keys and absolute URL consumers. F1, F24, F26. |
| §2 routing, embed, framing, metadata, clipboard | Reviewed header ordering, duplicate embed values, reload paths, UUID route restriction, cached layouts and provider hierarchy. F2, F18. The specified image sandbox and explicit non-goals were not re-filed as omissions. |
| §3 authentication and recovery | Inspected the pinned package, signed bearer behavior, mutable fields, session scope, popup binding, account-linking policy, reset routes, setup concurrency and recovery invariants. F1, F2, F24, F25, F27, F29. Real IdP/browser behavior remains a release gate. |
| §4 images | Audited upload decoding/multipart limits, HTML references, storage quotas, deletion and orphan sweep interactions. F4, F5, F13; pending-quota, direct-EXIF and GIF decisions above. |
| §5 AI and onboarding | Traced all six current model call paths, transport behavior, errors/logging, model input/output sizes, budget, background work, privacy fields, key identity and index state. F5, F7–F18, F22, F28. No paid real-provider requests were made. |
| §6 schema, migrations, boot | Reviewed foreign keys, revisions, migration transaction/locks, unknown migrations, pool ownership, TLS and sweeps. F3, F9–F14, F23, F24, F28. Existing services/databases were not mutated. |
| §7 first run and recovery | Reviewed code precedence, incomplete signup cleanup, scope construction, concurrent claiming and zero-admin recovery. F2, F24, F27. The design's explicitly accepted crash-between-signup-and-commit tradeoff was not treated as newly discovered. |
| §8 packaging and operations | Checked Docker/Compose settings, Postgres entrypoint, backups/restores, native builds, cloud definitions and upgrade assumptions. F6, F19–F21. Render definitions align with the checked current Blueprint fields; live billing/deploys were not claimed as tested. |
| §9 widget | Reviewed required URL behavior, root/path contract, mixed content, postMessage origin/source, sandbox, public API/CORS, packing and version compatibility. F2 and F11 affect the embedded product; package/browser checks remain required. |
| §10 runtime/client configuration | Audited configuration authority, public payload, process state and propagation to active clients/replicas. F8, F9, F17, F18, F25. |
| §11 docs and environment reference | Checked operational claims against the specified algorithms. F3, F6, F19, F20, F26, F27; additional accuracy corrections above. |
| Surfaces, phases, release process | Traced phase placement and implementation fallout. F2, F15, F21, F26 require explicit changes to the named surfaces and gates. Native artifacts need application-level compatibility proof in addition to database migration tests. |
| Risks, V0–V18, Appendices A/B | Read every check and mapped findings to missing negative cases. Assertions based on steady-state single-replica examples do not establish concurrency, transition or resource guarantees. |

**How the evidence should be characterized.**

The proposed files named in Appendix B and Verification are not presently committed on this branch: compose.yml, Dockerfile, scripts/ci-gates.ts, scripts/e2e and the proposed application implementation are absent. That is normal for a design awaiting implementation, but the document's statements that these checks already re-prove the historical scratchpad measurements should be changed to future proof obligations. Neither the prior audit's reviewer count nor this report substitutes for those committed implementation gates.

The accompanying harness tests the specified algorithms/current predicates on synthetic tables and the exact proposed packages. The image-quota and insights-start demonstrations establish why the missing synchronization rules matter; they are not claimed to execute nonexistent future endpoint code. Timestamp collision counts depend on scheduling, while equality being allowed by the schema and the stale-write consequence do not. The memory calculation is an analytical bound; no OOM was triggered. The Postgres image and HNSW findings are based on upstream behavior, not a local Docker run.

**Reproducing the local package/SQL checks.**

Create a disposable dependency directory and a disposable PostgreSQL 17 cluster. Use a database superuser named review, trust authentication, loopback only, port 55437. The harness intentionally hard-codes that endpoint so it cannot accidentally follow the application's DATABASE_URL. Do not point it at an existing application database. It creates a fresh random schema per run and leaves that synthetic schema for inspection.

Install exactly better-auth@1.7.6, @ai-sdk/openai-compatible@3.0.48, ai@7.0.99, pg@8.23.0, kysely@0.29.5 and js-tiktoken@1.0.21 into the disposable dependency directory. Set REVIEW_DEPENDENCY_DIR to its absolute path, then run the accompanying .mjs script with Node. All keys, passwords and addresses in these tests are synthetic. No OpenRouter or IdP request is needed.

**Disposition.** Resolve the six P1 findings first. Then amend the normative text and phase gates for the P2 invariants, especially concurrency, configuration transitions, search pagination and recovery. Replace the approval claim with a status that distinguishes reviewed design from implemented and passing evidence. Re-review the resulting implementation against those corrected gates before declaring the security and operational guarantees fulfilled.
