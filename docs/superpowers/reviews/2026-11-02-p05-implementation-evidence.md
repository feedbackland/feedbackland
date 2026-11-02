# P05 implementation and verification

Date: 2026-11-02. Base: P04's final tip
`2014cc399487100185321f21f080a7deae6efea4` (`codex/setup-auth`, PR #15).
The user explicitly authorized starting P05 while P04 remained open. This is a
separate, stacked code PR; P04 must merge before this PR. P06 has not started.

## Delivered behavior

Social sign-in uses a first-party confirmation popup and a server-mediated,
ten-minute, one-time handoff. The opener generates independent 128-bit ticket
and secret values before the click; only the secret hash enters the popup URL.
GET does not reserve a ticket. A signed HttpOnly cookie permits retries of the
same pending reservation. OAuth state carries server-only ticket/hash/mode
context, and only the actual callback binds a result. The done page has no
binding authority. Polling works without an opener and never reads `popup.closed`.
It also continues when COOP returns no usable popup handle; an explicit new-tab
link gives a blocked-popup fallback without treating a missing handle as failure.

Embedded callbacks create a separately scoped SDK session, remove their temporary
first-party session/cookie and preserve any earlier valid first-party cookie.
That cleanup also runs after ticket expiry or binding failure. Claim compares
the secret in constant time, returns pending without consumption, atomically
consumes a bound result and signs the raw embedded session token once. Wrong
secrets cannot consume a ticket. Bearer installation checks cancellation and the
opener's original credential generation. User/model content cannot link to
internal authentication or API paths.

Only configured providers on a resolved HTTPS app origin appear. Google and
Microsoft use the pinned SDK providers. Generic OIDC discovery has a ten-second
deadline, a 64 KiB response bound and strict HTTPS issuer/endpoints/JWKS/algorithm
validation. An epoch shared through PostgreSQL coordinates replicas; five-second
polling can abort an obsolete construction, and failed discovery retries after
one minute. Failure retains the last working Auth instance. Each HTTP request
captures one instance for its entire lifetime.

Better Auth 1.7.6 cannot accept a bounded pre-fetched discovery document. Its
generic provider is therefore constructed from validated endpoints through the
public plugin/provider API, with its shared ID-token verifier configured before
registration. Mandatory nonce, signature, issuer and audience checks are covered
against real signed tokens, including rejection of missing ID tokens. Additional
checks require subject/issued-at/expiry claims, constrain authorized-party claims
and match UserInfo's subject to the verified ID token. Providers that return
email only from UserInfo are supported. Account subjects are namespaced by issuer,
so replacing the configured issuer cannot adopt a previous issuer's same-named
subject. These checks use the
[OIDC validation requirements](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation).
Regression coverage is required when upgrading this pinned SDK. Account linking and provider
logout are disabled. Account create/update hooks remove access, refresh and ID
tokens before persistence; ordinary users cannot submit avatar URLs or roles.

The SDK's PostgreSQL rate-limit path also miscalculates retry deadlines when an
int8 timestamp arrives as a string. An injected atomic PostgreSQL storage keeps
its rolling-window behavior and computes deadlines with the database clock.
This does not change global int8 parsing or exact revision/ID handling.

SMTP uses Nodemailer with bounded connection/greeting/socket timeouts and disabled
debug logging. Known/unknown reset requests have the same response. Request-local
token capture uses one global AsyncLocalStorage channel across Next bundle layers;
administrator-issued reset links and operator recovery do not send email. Admin
links require a revalidated first-party administrator and a non-admin credential
account, work with inferred origins, recheck roles after SDK work and log only
issuer/target IDs and time. Reset tokens and URLs are not logged.

Recovery checks a configured random 32-byte code and a fail-closed IP limiter
before account lookup. It resets an existing administrator's credential account,
or promotes an existing credential account only when no administrators remain.
It never creates users or adds passwords to social-only accounts. A durable
owner/operation claim fences SDK work. Only the claim row is locked on a separate
connection during Auth I/O; membership/settings locks never span it. Competing
initial claims use NOWAIT so the minimum application pool cannot deadlock.

The final transaction rechecks ownership, expiry, code and administrator count,
then promotes and revokes sessions atomically. Lost commit acknowledgements are
reconciled. Interrupted resets report possible password changes; a committed
reset marker resumes promotion using the earlier password after claim expiry.
A completed claim cannot report success after its account was demoted. Operators
must remove the recovery code from every replica and restart them after use;
the disabled route returns 404 before streaming starts.
If a worker is suspended inside Auth I/O, its claim-row lock deliberately
prevents replacement even after nominal expiry. Stop that stalled worker before
retrying. This fences delayed password writes; it does not hold membership or
settings locks while waiting. The operator's replica restart is the termination
boundary for an indefinitely stalled SDK/database operation.

## Verification record

Native checks pass for cold TypeScript, changed-code/removal lint, import
boundaries, the existing P04 Auth/authorization suite, the popup client contract,
and the new PostgreSQL/OIDC contracts. Those contracts include exact concurrent
limiter admission/deadlines, wrong-code and unavailable-limiter refusal,
admin-only reset restrictions, zero-admin repair, social-only refusal, interrupted
reset/promotion, stale owners, competing claims with minimum pool, an intervening
administrator, lost final COMMIT acknowledgement, code removal, handoff CAS and
single consumption, immutable expiry and forbidden content links.

The cumulative phase-4 production-image/browser run and current-head CI are still
in progress. No pending group is counted as passed. The canonical result will be
linked here when complete.

The HTTPS fixture owns pinned PostgreSQL, Caddy and Mailpit containers and an
ephemeral local certificate volume. Both the board and mock OIDC provider use
HTTPS; app replicas trust only that additional fixture CA. Real Helmet middleware
and enforcing provider COOP are exercised with the built workspace widget in
Chromium, Firefox and Linux WebKit. Header observations drain before teardown;
unreadable headers fail. The exact benign WebKit cross-origin focus diagnostic
uses the existing P04 exception; other uncaught errors/rejections fail.
Private certificate keys stay outside retained artifacts and are removed with
the owned containers/volume and temporary directory.

## Review and release boundary

This remains a disposable integration milestone. No hosted credentials/data,
real Google/Microsoft accounts, published image or production deployment is used.
Real Google/Microsoft and Safari/device acceptance remains release work. Images,
AI and full search remain later milestones. P05 does not claim those gates.

The lockfile adds Nodemailer and Helmet, declares the existing jose version
directly, and records six optional WASM support packages selected by npm. No
retained package version changes. There is no broad dependency upgrade/audit fix.
