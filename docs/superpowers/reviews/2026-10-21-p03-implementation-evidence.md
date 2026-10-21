# P03 surface isolation, framing and navigation

P03 builds on merged P02 and retains the six review fixes from PR #13. It
changes provider ownership, browser transports, framing, navigation, metadata
and content/clipboard output. It does not change the database schema or enable
authentication. Merge PR #13 before this milestone.

## Delivered behavior

The document layout owns theme and generic UI infrastructure. Board content
mounts under `EmbedProvider → SurfaceProviders → SettingsProvider`.
An absent proxy hint stays unresolved through SSR and hydration; descendants
do not mount until the browser resolves the URL. Each resolved surface gets
a new query client, tRPC transport, auth provider instance and Jotai state.
Disposal aborts outstanding transport requests, cancels queries and clears the
cache. A microtask distinguishes real disposal from React StrictMode's
immediate effect replay. Theme state also remounts when its storage scope changes.

Admin pages move outside the board into an explicit first-party route group.
First-party providers do not mount in a frame, and AdminRoot separately checks
the top-level window before rendering or redirecting. Drawer API requests use
`credentials: omit`; public settings polling remains credential-free on every
surface. Public SSR does not resolve an ambient session.

The ordered header rules deny framing by default, sandbox image responses,
then permit only the public root and UUID post paths with the drawer signal.
The proxy strips supplied presentation hints. Because Next's header matcher
uses only the last repeated query value, the proxy also applies the any-match
framing result on those two public paths; it cannot override private/image
denials. Both repeated-value orders use drawer presentation with the proxy.
With the proxy deliberately disabled, a nonmatching last query value retains
the configured framing denial; canonical widget URLs still resolve safely.

Invalid single-segment post paths and `/robots.txt` return 404 before streaming
starts; the server post page retains `notFound()` validation for deployments
without proxy execution. Only `/admin` is currently an active static root page.
P04/P05 must extend that allowance when their setup/recovery pages actually land.
This avoids advertising nonexistent pages with Next's streamed HTTP 200 shell.

Board links retain embed and mode parameters. Theme initialization no longer
deletes mode. Global-error reload/back callbacks preserve the current query;
invitation processing refreshes session state instead of reloading. User
content anchors open separately with `noopener noreferrer nofollow`. Embedded
administrative overrides are hidden, while future own-content actions retain
their author path.

Status output uses an exact five-value allowlist. Invalid labels become inert
text, including in server sanitization; user input never supplies a CSS class.
Images without usable dimensions have a plain-image fallback. All copy sites
use one helper with secure clipboard, native plain-HTTP copy and a selected
read-only manual fallback. Callers report success only when copying completed;
image copying is unavailable in insecure contexts.

Public metadata follows the indexing setting when the proxy confirms a
first-party surface; drawer/private pages and missing hints discourage indexing.
Metadata has an absolute base and neutral icon, and falls back safely
on a failed settings read. The indexing editor retains revision CAS. Unused
brand images and the unreferenced logo component are removed.

## Gates and proof boundaries

`npm run verify -- --phase 2 --image feedbackland:ci --artifacts artifacts/self-hosting`
retains every phase-1 group and adds static SSR/content checks plus the
Chromium drawer harness. CI installs the pinned Playwright Chromium and runs
that cumulative entrypoint, alongside the separate development smoke.

The first cumulative attempt exposed a phase-1-only run-ID guard, which now
accepts phase 2. A fresh Windows checkout also converted the generated schema
to CRLF, failing the generator's exact comparison despite unchanged types.
`.gitattributes` now pins that generated file to LF; the schema content is
unchanged. The full matrix remains blocking rather than bypassing this check.

The drawer harness uses the actual built widget and production app image. It
checks full header values, metadata, literal sandbox attributes, post navigation,
frame reload, injected deployment-ID mismatch and RSC 502 recovery. It waits
for the widget's loading overlay to release pointer input before clicking the
iframe. A separate derived fixture removes only the generated proxy registration
to exercise the missing-hint SSR/hydration path; it is not the production image.

Fresh same-site and cross-site browser contexts observe requests from initial
mount. A sentinel cookie challenges document navigation; script API requests
must omit it. Held real tRPC requests must abort on surface disposal, and a new
surface must fetch again. A client navigation to admin inside the already-
allowed frame must refuse rendering. The global-error component's callbacks
are also exercised in an isolated browser fixture; the RSC fault/recovery
checks run against the real application.

These are pre-authentication proofs using sentinel cookies. They do not certify
real cookie/bearer session isolation: P04 must replay the matrix with actual
first-party and embedded sessions and run the three-engine credential flow.
OAuth, uploads, AI, semantic search and release operations remain later work.
All test databases and resources are harness-owned; no operator dotenv or
application database is used. A successful report is written only after cleanup.
The browser database uses an asserted tmpfs mount and no Docker volume; owned
container removal also requests anonymous-volume removal. The cleanup audit
identified the preceding run's orphan through its Docker mount events and
removed that exact unused fixture volume. Unrelated historical volumes were
not treated as test-owned.

## Validation record

Final local run `p03-1792581110380-3de2f39d` passed all 15 cumulative groups,
including the revised tmpfs/no-volume assertion and full browser matrix.
The [machine-readable report](2026-10-21-p03-verification.json) records each
group. The equivalent direct Node entrypoint was used to retain console output:
`node --conditions=react-server --import tsx scripts/verify.ts --phase 2 --image feedbackland:ci --artifacts artifacts/self-hosting`.
CI continues to exercise the canonical npm entrypoint.

- Local image: `sha256:0d6f708d0eede1361c73101bc1f0294d09da5128caf820433880eb1dcff927ae`.
- Image artifact identity: `b3885472358ddd1e559f6081c20753adceb90bd7abb6a67cc77aae0374de5b80`.
- Verified source tree: `c74dbe65a2235a231cad6efdd84b07295b37b7a5d6db43a1009181e205ad20a1`.
- Offline production build, TypeScript, scoped lint and caller inventory passed.
- Separate development boot, migration, singleton settings and root board passed.
- No phase-2 containers or networks remained after the final run.

This image was built from the P03 working tree before its commit, so its
`sourceCommit` is explicitly null. The report's checkout is the parent commit;
the verified source-tree fingerprint identifies the tested production inputs.
CI independently rebuilds the submitted merge checkout with `SOURCE_COMMIT`
enforced; its final revision and results are visible on the implementation PR.

One later npm/tsx invocation exited before writing a result; its exact Compose
project and volumes were removed. Its empty temporary folder
`p03-1792580979405-de9d7bb5-KhUezB` (only a zero-byte `.env`) remains locally:
automatic approval review rejected its removal as "blocked by policy" without
a more specific reason. No removal was retried. This is separate from the
successful final run, whose harness cleanup completed.

P04 starts after review and merge of this milestone.
