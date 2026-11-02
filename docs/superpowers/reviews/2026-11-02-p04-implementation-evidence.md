# P04 implementation and verification

Date: 2026-11-02. Base: `e49002fff2122eeaf6c1f938f2571e88e80dca4f`
(`single-tenant-self-hosting`, including merged PRs #13 and #14).
Milestone: P04, phase 3. P05 is excluded.

## Result

The branch implements one-time setup and email authentication using the exact
Better Auth 1.7.6 schema established in P02. Firebase and its configuration are
removed. The lockfile removes 235 packages; no retained package version changes.

Setup has five fields, validates a random 32-byte code, and checks its fail-closed
5-attempt/15-minute IP limiter before comparing the code. A dedicated one-connection
pool holds the setup and membership locks while Better Auth uses the app pool.
The action promotes only its newly created user, consumes the code, updates the
board name and revision, and establishes the first-party cookie. Existing users
are never adopted. Signup failures roll back Better Auth's transaction; a failure
after successful signup compensates by deleting that new user after the outer
transaction rolls back. Boot locks the settings row before deciding whether a
setup code may be persisted, preventing a stale pre-claim read from restoring it.

Auth construction remains lazy and globally shared across Next bundle layers.
The initial setup transition remounts the credential and query providers before
admin UI uses the new cookie. HTTP smoke coverage exercises Next's actual Request
wrapper; embedded requests are rebuilt from URL and body stream without the
native Request copy constructor's private-field failure.

## Authorization and isolation

- First-party clients use HttpOnly, SameSite=Lax cookies and `credentials: include`.
  They receive no `set-auth-token` header or exposure of that header.
- Drawer clients use signed bearer tokens, `credentials: omit`, local storage
  with a memory fallback, and immutable database scope `embedded`. Late replies
  cannot repopulate cleared credentials or write from a disposed surface.
- Explicitly embedded auth/tRPC requests discard ambient cookies on the server.
  This only reduces the accepted credentials; it never grants authority from a
  request header. Bearer and forged-cookie replay still use database scope.
- Administrative authority requires a matching, unexpired first-party session,
  an admin role, and an absolute session age below seven days. Rolling refresh
  does not extend that window. Each of the four author-or-admin content writes
  rechecks identity, expiry and role in its final transaction under membership
  serialization. Invite redemption additionally checks scope, age, expiry,
  matching email and single consumption.
- Sign-out failure is reported without claiming the cookie was revoked. A local
  sign-out masks only the revoked session, allowing a later valid session to
  appear. Identity changes reset active queries and remove inactive cached data.
  Mounted query observers remain attached, so posting after reauthentication
  refreshes the board without navigation or reload.
- Auth HTTP writes, tRPC mutations and the public posting/chat endpoints are
  locked before setup. tRPC/chat reject non-JSON mutation bodies and same-site
  or cross-site fetches before handlers execute. Better Auth retains its origin
  validation. Password failures use a normalized, SHA-256 email bucket; IP
  resolution agrees with the app's trusted-proxy resolver.
- Role input is disabled; account deletion is disabled. Names are trimmed and
  bounded, reply labels are escaped before editor HTML construction, and only
  trusted provider callbacks may set an HTTPS avatar. Absent/undefined avatar
  updates preserve the existing value; explicit caller-supplied images fail.

## Verification

All **21 cumulative phase-3 groups passed** on the final application tree,
including the empty-board reauthentication regression in every engine.
The [machine-readable result](2026-11-02-p04-verification.json) is an unmodified
copy of the sanitized canonical runner summary.

Verification includes:

- Cold TypeScript checking, changed-code/removal lint and import boundaries.
- Actual setup and email flows in Chromium, Firefox and Linux WebKit, including
  sign-in/out, own post/comment changes and deletion, voting, profile updates,
  failed sign-out, cross-tab refresh after local sign-out, same-site/cross-site
  drawers and denied-storage fallback.
- Real Better Auth/SQL/HTTP tests for concurrent setup, limiter failure, code
  consumption, pre-existing identities, forced signup/session failure and
  post-signup rollback compensation at `DATABASE_POOL_MAX=2`.
- Signed bearer and cookie replay against privilege overrides, raw-token refusal,
  revoked bearer precedence, admin aging/demotion/revocation, invite constraints,
  rolling expiry, password replacement scope, independent drawer sign-out,
  avatar preservation, CSRF and trusted multi-hop IP/email throttles.
- Repeated standalone setup with an injected secret and minimum pool, plus
  keyless development setup with a code read from its private startup log.

The full command is:

```sh
npm run verify -- --phase 3 --image feedbackland:p04 --artifacts artifacts/self-hosting
```

The cumulative gates retain PG15/18, vector/halfvec widths and extension schemas,
exact auth DDL/generated types, transaction-pooler rollback/retry, TLS policy,
startup/readiness failures, persistence, source identity and P03 drawer checks.
The P03 normal/missing-proxy fixtures now carry real first-party admin cookies.
All fixtures own disposable databases, names and ports and clean up afterward.

### Source identity and CI

- Local run: `p04-1793610531683-ca665a78`, Ubuntu-based Playwright 1.64.1 runner,
  Linux amd64, Node 24.22.1. A private nested Docker daemon avoids Docker Desktop's
  host-network limitation; only that run's daemon, volume and fixtures were removed.
- Image identity: `sha256:52270c38b5f12b271600a3d513722725518edb09f4a53c143608d9e2a2b409de`.
- Application source tree: `bf2500637e43d9f46899966d3c2a310374a061c0d25d607c81d4072256714d59`.
  Recomputed against the final working tree and matched by the image gate.
- Image artifact: `bad0a6df1011ac800ab2c9577c44b6ba0499243f4b6f427e5e4314c217b1d0e5`.
  Local `sourceCommit` is null because this image was built before the final
  commit. The private verifier overlays the working files on an `e49002f` base;
  its `checkout` field reports that base, not the P04 commit. The source-tree
  hash identifies the actual application bytes. Documentation and test files
  are outside the image's application-input hash; the updated tests ran from
  the working-tree overlay.
- GitHub CI builds the actual PR checkout with `SOURCE_COMMIT`, cold typechecks,
  runs the cumulative matrix and keyless development smoke, and uploads evidence
  for 14 days. See the [current PR checks](https://github.com/feedbackland/feedbackland/pull/15/checks)
  for the final head's Actions and Vercel results; these remain review blockers.

### Interactive V2 walkthrough

Walked through the in-app browser on 2026-11-02 against the local image, using
`compose.yml` with an empty tool env-file, no repository `.env`, no `APP_URL`, no
auth secret and no model key. The fresh database belonged exclusively to
`p04-manual-9470c660`. Setup used the generated private startup-banner code;
no code, password, cookie or bearer value is included in this record.

1. Opened `http://localhost:3000`, completed the five setup fields, and reached
   the rendered admin activity page. Signed out and signed back in using email.
2. The first submission was persisted but left the empty list visible. This
   exposed `QueryClient.clear()` detaching mounted observers during sign-in.
   Replaced that behavior with cancellation, inactive-query removal and active
   query reset. Recreated only the disposable app with the rebuilt image, then
   repeated sign-out/sign-in and submission: the post appeared without a reload.
   The new regression fails on the previous image at the missing post and passes
   on the fixed image in Chromium, Firefox and Linux WebKit.
3. Opened the saved post, upvoted it, added a comment, edited the comment and
   edited the post. The [fixture screenshot](2026-11-02-p04-manual.png) records the
   edited title/comment, vote count and admin navigation.
4. Served the built workspace widget from `http://127.0.0.1:4173`, embedding the
   localhost board while holding its first-party admin session. The drawer
   started signed out, accepted an anonymous submission and displayed it.
5. Repeated email sign-in, post/comment creation, voting, both edits and admin
   access using the machine's plain HTTP LAN address on port 3000. The widget
   installation Copy action displayed its success checkmark through the insecure
   context fallback. A widget on the 127.0.0.1 host also embedded the LAN board,
   started signed out and displayed its anonymous submission.
6. Closed the three owned browser tabs and stopped the widget server. Removed
   only this Compose project's containers, network and database volume, removed
   the private setup-code capture, and checked that its resources were absent.

Search and images were excluded as required before their milestones. This is an
agent-driven interactive walkthrough, not a claim of human or real-device testing.

## Limits and review boundary

This remains a disposable integration milestone. Social sign-in, mail/password
reset, operator recovery, images, AI and complete search remain later work.
No later gate or real Safari-device check is counted as passed.

The Windows WebKit 1.64.1 binary sends cookies even for a plain
`fetch(..., {credentials: "omit"})`, and reports a localhost cookie as
`SameSite=None` despite the wire header specifying Lax. Chromium and Firefox
omit those cookies. The mandatory three-engine matrix runs on Linux and checks
actual request cookies; no Windows exception weakens that assertion. Setup
checks the actual HttpOnly/SameSite response header and script invisibility.
The normative behavior is defined by the [Fetch Standard](https://fetch.spec.whatwg.org/#concept-request-credentials-mode).

Compensation is not a durable saga: process termination or database failure
between Better Auth signup and setup commit/cleanup can leave an ordinary
account. Setup refuses to adopt it; operator cleanup may be needed. This does
not reopen a claimed setup or promote that account on retry. Do not use this
pre-release branch against an existing production database.

After independent review and merge of P04, proceed to P05 social handoff and
operator recovery. No merge or P05 implementation is part of this change.
