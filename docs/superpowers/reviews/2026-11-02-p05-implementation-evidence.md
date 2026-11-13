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
context. A signed cookie scoped to the provider callback binds the issued OAuth
state and ticket for failures that precede SDK state validation. Unknown states
leave pending tickets available. Only the actual callback binds a result. The done page has no
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
one minute. Failure retains the last working Auth instance. Public settings and
Google/Microsoft starts use the available providers immediately. Only an OIDC
start waits for pending OIDC discovery. The token endpoint uses the registered
and advertised Basic or POST method, with Basic as the discovery default.

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
account, work with inferred origins, and store the issuer at issuance. Redemption
locks the target and rechecks both roles. Account email resets record the account
as their own issuer. Password changes and recovery delete outstanding reset grants.
Issuance logs contain only issuer/target IDs and time.

Recovery checks a configured random 32-byte code and a fail-closed IP limiter
before account lookup. It resets an existing administrator's credential account,
or promotes an existing credential account only when no administrators remain.
It never creates users or adds passwords to social-only accounts. A durable
owner/operation claim identifies the current worker. It hashes the new password
outside the transaction, then rechecks ownership, account, code and expiry.
The SDK writes the credential and revokes sessions on the same PostgreSQL
transaction that records the credential fingerprint and revokes reset grants.
Ordinary sign-in and password changes recheck their original credential proof
under the account lock before writing a session or credential.

The final transaction rechecks ownership, expiry, code, credential fingerprint
and administrator count, then promotes and revokes sessions and reset links
atomically. Recovery reconciles a lost commit acknowledgement against the live
role and credential. An expired interrupted claim resumes with the earlier
password only if the credential still matches. Otherwise it resets the password
again before promotion. Operators remove the code from every replica and restart
them after use. The disabled route returns 404 before streaming starts.

## Verification record

Native checks pass for cold TypeScript, changed-code/removal lint, import
boundaries, the existing P04 Auth/authorization suite, the popup client contract,
and the new PostgreSQL/OIDC contracts. Those contracts include exact concurrent
limiter admission/deadlines, wrong-code and unavailable-limiter refusal,
admin-only reset restrictions, zero-admin repair, social-only refusal, interrupted
reset/promotion, stale owners, competing claims with minimum pool, an intervening
administrator, lost final COMMIT acknowledgement, code removal, handoff CAS and
single consumption, immutable expiry and forbidden content links.

The November 13 regression run upgrades a populated `0001_init` database,
exercises overlapping OAuth callbacks and denied reset grants through the HTTP
handler, and exchanges real authorization codes against Basic-only and POST-only
fixture registrations. It terminates the PostgreSQL backend between the SDK
password write and recovery marker, checks rollback, and completes a retry with
the minimum pool. Separate cases pause sign-in, password change and reset during
their password computation, complete recovery, and verify the stale requests fail.

The [PR #16 checks](https://github.com/feedbackland/feedbackland/pull/16/checks)
record the cumulative phase-4 result and its production-image evidence artifact.

On November 4, focused Linux runs on the same application image passed the
Chromium, Firefox and WebKit popup matrices, the known-account reset request
with spoofed forwarding headers, and the operator recovery browser flow.
That recovery flow exercised an inferred origin, session revocation, zero-admin
repair and HTTP 404 on all three replicas after code removal.

The HTTPS fixture owns pinned PostgreSQL, Caddy and Mailpit containers and an
ephemeral local certificate volume. Both the board and mock OIDC provider use
HTTPS; app replicas trust only that additional fixture CA. Real Helmet middleware
and enforcing provider COOP are exercised with the built workspace widget in
Chromium, Firefox and Linux WebKit. Header observations drain before teardown;
unreadable headers fail. The WebKit guard counts the exact mixed-protocol
focus diagnostic for the fixture host and board origins. Frame `error` and
`unhandledrejection` listeners independently check for thrown errors.
[WebKit diagnostic source](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/DOMWindow.cpp#L905)
The harness watches browser-context page creation so it can drive a COOP tab
even when Firefox does not emit a popup event on the opener page.
Private certificate keys stay outside retained artifacts and are removed with
the owned containers/volume and temporary directory.

## Review and release boundary

This remains a disposable integration milestone. No hosted credentials/data,
real Google/Microsoft accounts, published image or production deployment is used.
Real Google/Microsoft and Safari/device acceptance remains release work. Images,
AI and full search remain later milestones. P05 does not claim those gates.

The lockfile adds Nodemailer and Helmet, declares the existing jose, Better Auth
core and Kysely adapter versions directly, and records six optional WASM support packages selected by npm. No
retained package version changes. There is no broad dependency upgrade/audit fix.
