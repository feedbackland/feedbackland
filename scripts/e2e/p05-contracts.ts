import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "kysely";
import { db, getPool } from "../../db/db";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { getConfig } from "../../lib/config";
import { getAuth } from "../../lib/auth/server";
import { handoffStore } from "../../lib/auth/handoff-store";
import { completeRecovery, resetRecoveryPassword } from "../../lib/recovery";
import { createPasswordResetLinkQuery } from "../../queries/create-password-reset-link";
import { createContext } from "../../lib/trpc";
import {
  matchesOperatorCode,
  operatorCodeDigest,
} from "../../lib/operator-code";
import { isBlockedContentLink } from "../../lib/safe-content-link";
import { clean } from "../../lib/utils-server";
import { DomainError } from "../../lib/domain-error";
import { oidcContracts } from "./oidc-contracts";
import { authRateLimit } from "../../lib/auth/rate-limit";
import {
  withRecoveryCommitAckLoss,
  withRecoveryOwnerReplacement,
} from "./recovery-faults";

async function main() {
  const seeded = await migrateAndSeed();
  runtimeState().authSecret = seeded.authSecret;
  runtimeState().setupComplete = true;
  const limiterKey = "fixture-sdk-rate-limit";
  const admissions = await Promise.all(
    Array.from({ length: 25 }, () =>
      authRateLimit.consume(limiterKey, { window: 10, max: 3 }),
    ),
  );
  assert.equal(admissions.filter((value) => value.allowed).length, 3);
  assert(
    admissions
      .filter((value) => !value.allowed)
      .every((value) => value.retryAfter! >= 1 && value.retryAfter! <= 10),
  );
  await db
    .updateTable("auth_rate_limit")
    .set({
      lastRequest: sql`floor(extract(epoch from clock_timestamp())*1000)::bigint-11000`,
    })
    .where("key", "=", limiterKey)
    .execute();
  assert(
    (await authRateLimit.consume(limiterKey, { window: 10, max: 3 })).allowed,
  );
  await oidcContracts({
    db: getPool(),
    secret: seeded.authSecret,
    appUrl: "https://fixture.invalid",
  });
  await db
    .updateTable("settings")
    .set({ setupCompletedAt: sql`clock_timestamp()` })
    .where("id", "=", 1)
    .execute();
  const code = getConfig().recoveryCode!;
  assert(code);
  assert(
    matchesOperatorCode(Buffer.from(code, "hex").toString("base64"), code),
  );
  assert(!matchesOperatorCode("wrong", code));
  assert(!matchesOperatorCode(randomBytes(32).toString("hex"), code));
  assert.equal(
    operatorCodeDigest(Buffer.from(code, "hex").toString("base64")),
    operatorCodeDigest(code),
  );
  let counter = 0;
  const headers = (extra: Record<string, string> = {}) =>
    new Headers({
      host: "fixture.invalid",
      origin: "https://fixture.invalid",
      "content-type": "application/json",
      "x-forwarded-for": `192.0.2.${1 + (counter++ % 200)}`,
      "sec-fetch-site": "same-origin",
      ...extra,
    });
  const auth = async (
    path: string,
    body: unknown,
    expected: number,
    extra: Record<string, string> = {},
  ) => {
    const response = await getAuth().handler(
      new Request(`https://fixture.invalid/api/auth${path}`, {
        method: "POST",
        headers: headers(extra),
        body: JSON.stringify(body),
      }),
    );
    assert.equal(
      response.status,
      expected,
      `${path} returned ${response.status}`,
    );
    return response;
  };
  const password = "Fixture-password-42";
  const signup = async (email: string) =>
    (
      await getAuth().api.signUpEmail({
        body: { name: "Recovery fixture", email, password },
      })
    ).user;
  const admin = await signup("admin@fixture.invalid");
  const user = await signup("user@fixture.invalid");
  const socialOnly = await signup("social@fixture.invalid");
  await db
    .deleteFrom("auth_account")
    .where("userId", "=", socialOnly.id)
    .execute();
  await db
    .insertInto("auth_account")
    .values({
      id: randomBytes(16).toString("hex"),
      userId: socialOnly.id,
      accountId: "fixture-sub",
      providerId: "oidc",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .execute();
  await db
    .updateTable("user")
    .set({ role: "admin" })
    .where("id", "=", admin.id)
    .execute();
  const login = await auth(
    "/sign-in/email",
    { email: admin.email, password },
    200,
  );
  const cookie = login.headers
    .getSetCookie()
    .find((value) => value.includes("better-auth.session_token="))!
    .split(";", 1)[0];
  assert(cookie);
  const actor = await createContext({
    req: new Request("https://fixture.invalid/api/trpc", {
      headers: headers({ cookie }),
    }),
  });
  assert(actor.canAdminister);
  const adminActor = { userId: admin.id, sessionId: actor.sessionId };
  await assert.rejects(
    createPasswordResetLinkQuery(adminActor, admin.email, headers()),
    /non-admin/,
  );
  await assert.rejects(
    createPasswordResetLinkQuery(adminActor, socialOnly.email, headers()),
    /non-admin/,
  );
  const resetLink = await createPasswordResetLinkQuery(
    adminActor,
    user.email,
    headers({ "x-forwarded-host": "evil.example" }),
  );
  assert.equal(new URL(resetLink.url).origin, "https://fixture.invalid");
  assert.equal(new URL(resetLink.url).pathname, "/reset-password");
  const resetToken = new URL(resetLink.url).searchParams.get("token")!;
  await auth(
    "/reset-password",
    { token: resetToken, newPassword: " User-changed-password-42 " },
    200,
  );
  await auth(
    "/reset-password",
    { token: resetToken, newPassword: password },
    400,
  );
  await auth(
    "/sign-in/email",
    { email: user.email, password: "User-changed-password-42" },
    200,
  );
  // Mutate authority at the actual SDK token-insertion boundary. The final
  // role recheck must refuse the response and remove the captured token.
  for (const boundary of ["target-promoted", "issuer-demoted"] as const) {
    const before = await db
      .selectFrom("auth_verification")
      .select("id")
      .where("value", "=", user.id)
      .where("identifier", "like", "reset-password:%")
      .execute();
    const body =
      boundary === "target-promoted"
        ? `update "user" set role='admin' where id=NEW.value;`
        : `update "user" set role='user' where email='admin@fixture.invalid';`;
    await sql
      .raw(
        `create function fixture_reset_boundary() returns trigger language plpgsql as $$ begin if NEW.identifier like 'reset-password:%' then ${body} end if; return NEW; end $$`,
      )
      .execute(db);
    await sql`create trigger fixture_reset_boundary before insert on auth_verification for each row execute function fixture_reset_boundary()`.execute(
      db,
    );
    try {
      await assert.rejects(
        createPasswordResetLinkQuery(adminActor, user.email, headers()),
        /non-admin|first-party administrator/,
      );
    } finally {
      await sql`drop trigger fixture_reset_boundary on auth_verification`.execute(
        db,
      );
      await sql`drop function fixture_reset_boundary()`.execute(db);
      await db
        .updateTable("user")
        .set({ role: "user" })
        .where("id", "=", user.id)
        .execute();
      await db
        .updateTable("user")
        .set({ role: "admin" })
        .where("id", "=", admin.id)
        .execute();
    }
    assert.deepEqual(
      await db
        .selectFrom("auth_verification")
        .select("id")
        .where("value", "=", user.id)
        .where("identifier", "like", "reset-password:%")
        .execute(),
      before,
    );
  }
  await assert.rejects(
    completeRecovery(
      { code: "wrong", email: admin.email, password },
      headers(),
    ),
    /Recovery could not/,
  );
  await assert.rejects(
    completeRecovery({ code, email: user.email, password }, headers()),
    /Recovery could not/,
  );
  await assert.rejects(
    completeRecovery(
      { code, email: "absent@fixture.invalid", password },
      headers(),
    ),
    /Recovery could not/,
  );
  const failures = headers({ "x-forwarded-for": "198.51.100.2" });
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      completeRecovery(
        { code: "wrong", email: admin.email, password },
        failures,
      ),
      /Recovery could not/,
    );
  await assert.rejects(
    completeRecovery({ code, email: admin.email, password }, failures),
    /Too many attempts/,
  );
  await sql`alter table rate_limit rename to rate_limit_fixture`.execute(db);
  try {
    await assert.rejects(
      completeRecovery({ code, email: admin.email, password }, headers()),
      /temporarily unavailable/,
    );
  } finally {
    await sql`alter table rate_limit_fixture rename to rate_limit`.execute(db);
  }
  const recovered = await completeRecovery(
    { code, email: admin.email, password: "Admin-recovered-password-42" },
    headers(),
  );
  assert(recovered.restored);
  assert.equal(
    (
      await db
        .selectFrom("auth_session")
        .select("id")
        .where("userId", "=", admin.id)
        .execute()
    ).length,
    0,
  );
  await auth("/sign-in/email", { email: admin.email, password }, 401);
  await auth(
    "/sign-in/email",
    { email: admin.email, password: "Admin-recovered-password-42" },
    200,
  );
  const repeated = await completeRecovery(
    {
      code: Buffer.from(code, "hex").toString("base64"),
      email: admin.email,
      password,
    },
    headers(),
  );
  assert(repeated.previousPassword);
  await auth("/sign-in/email", { email: admin.email, password }, 401);
  // Deliberately repair zero admins. A social-only identity must remain so.
  await db.updateTable("user").set({ role: "user" }).execute();
  await assert.rejects(
    completeRecovery({ code, email: socialOnly.email, password }, headers()),
    /Recovery could not/,
  );
  assert.equal(
    (
      await db
        .selectFrom("auth_account")
        .select("id")
        .where("userId", "=", socialOnly.id)
        .where("providerId", "=", "credential")
        .execute()
    ).length,
    0,
  );
  const repaired = await completeRecovery(
    { code, email: user.email, password: "Zero-admin-repair-42" },
    headers(),
  );
  assert(repaired.restored);
  assert.equal(
    (
      await db
        .selectFrom("user")
        .select("role")
        .where("id", "=", user.id)
        .executeTakeFirstOrThrow()
    ).role,
    "admin",
  );
  assert.equal(
    (
      await db
        .selectFrom("auth_session")
        .select("id")
        .where("userId", "=", user.id)
        .execute()
    ).length,
    0,
  );
  // A crash after the SDK reset but before the durable reset marker must not
  // grant the role. The same operator code is retryable after claim expiry.
  const interrupted = await signup("interrupted@fixture.invalid");
  await db.updateTable("user").set({ role: "user" }).execute();
  await sql`create function fixture_recovery_failure() returns trigger language plpgsql as $$ begin if NEW.status='reset' then raise exception 'fixture reset-marker failure'; end if; return NEW; end $$`.execute(
    db,
  );
  await sql`create trigger fixture_recovery_failure before update on recovery_claim for each row execute function fixture_recovery_failure()`.execute(
    db,
  );
  try {
    await assert.rejects(
      completeRecovery(
        { code, email: interrupted.email, password: "Interrupted-password-42" },
        headers(),
      ),
      /password may already/,
    );
  } finally {
    await sql`drop trigger fixture_recovery_failure on recovery_claim`.execute(
      db,
    );
    await sql`drop function fixture_recovery_failure()`.execute(db);
  }
  assert.equal(
    (
      await db
        .selectFrom("user")
        .select("role")
        .where("id", "=", interrupted.id)
        .executeTakeFirstOrThrow()
    ).role,
    "user",
  );
  await auth(
    "/sign-in/email",
    { email: interrupted.email, password: "Interrupted-password-42" },
    200,
  );
  await db
    .updateTable("recovery_claim")
    .set({ expiresAt: sql`clock_timestamp()-interval '1 second'` })
    .where("userId", "=", interrupted.id)
    .execute();
  assert(
    (
      await completeRecovery(
        { code, email: interrupted.email, password: "Retried-password-42" },
        headers(),
      )
    ).restored,
  );
  // A committed reset marker survives a failed promotion. Resume must report
  // that the earlier password remains, rather than silently claim the new one.
  const promotion = await signup("promotion@fixture.invalid");
  await db.updateTable("user").set({ role: "user" }).execute();
  await sql`create function fixture_promotion_failure() returns trigger language plpgsql as $$ begin if NEW.role='admin' then raise exception 'fixture promotion failure'; end if; return NEW; end $$`.execute(
    db,
  );
  await sql`create trigger fixture_promotion_failure before update on "user" for each row execute function fixture_promotion_failure()`.execute(
    db,
  );
  try {
    await assert.rejects(
      completeRecovery(
        {
          code,
          email: promotion.email,
          password: "Before-promotion-password-42",
        },
        headers(),
      ),
      /password may already/,
    );
  } finally {
    await sql`drop trigger fixture_promotion_failure on "user"`.execute(db);
    await sql`drop function fixture_promotion_failure()`.execute(db);
  }
  assert.equal(
    (
      await db
        .selectFrom("recovery_claim")
        .select("status")
        .where("userId", "=", promotion.id)
        .executeTakeFirstOrThrow()
    ).status,
    "reset",
  );
  await assert.rejects(
    completeRecovery({ code, email: promotion.email, password }, headers()),
    /in progress/,
  );
  await db
    .updateTable("recovery_claim")
    .set({ expiresAt: sql`clock_timestamp()-interval '1 second'` })
    .where("userId", "=", promotion.id)
    .execute();
  const resumed = await completeRecovery(
    { code, email: promotion.email, password: "Must-not-replace-password-42" },
    headers(),
  );
  assert(resumed.restored && resumed.previousPassword);
  await auth(
    "/sign-in/email",
    { email: promotion.email, password: "Before-promotion-password-42" },
    200,
  );
  await auth(
    "/sign-in/email",
    { email: promotion.email, password: "Must-not-replace-password-42" },
    401,
  );
  // With one ordinary app connection, a competing claimant must release it
  // immediately while the isolated owner holds its claim row before Auth I/O.
  const concurrent = await signup("concurrent@fixture.invalid");
  await db.updateTable("user").set({ role: "user" }).execute();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const first = completeRecovery(
    { code, email: concurrent.email, password: "Concurrent-password-42" },
    headers(),
    {
      resetPassword: async (...args) => {
        entered();
        await gate;
        await resetRecoveryPassword(...args);
      },
    },
  );
  const firstResult = first.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await Promise.race([
      ready,
      firstResult.then((result) => {
        if ("error" in result) throw result.error;
        throw new Error("Recovery completed before the barrier");
      }),
    ]);
    const second = completeRecovery(
      { code, email: concurrent.email, password },
      headers(),
    );
    await assert.rejects(
      Promise.race([
        second,
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(new Error("Competing recovery held the app connection")),
            2000,
          ),
        ),
      ]),
      (error: unknown) =>
        error instanceof DomainError && /in progress/.test(error.message),
    );
  } finally {
    release();
  }
  const completed = await firstResult;
  if ("error" in completed) throw completed.error;
  assert(completed.value.restored);

  const lostAck = await signup("recovery-lost-ack@fixture.invalid");
  await db.updateTable("user").set({ role: "user" }).execute();
  const reconciled = await withRecoveryCommitAckLoss(() =>
    completeRecovery({ code, email: lostAck.email, password }, headers()),
  );
  assert(reconciled.restored);
  assert.equal(
    (
      await db
        .selectFrom("user")
        .select("role")
        .where("id", "=", lostAck.id)
        .executeTakeFirstOrThrow()
    ).role,
    "admin",
  );
  await db
    .updateTable("user")
    .set({ role: "user" })
    .where("id", "=", lostAck.id)
    .execute();
  await assert.rejects(
    completeRecovery({ code, email: lostAck.email, password }, headers()),
    /could not be completed/,
  );
  const replaced = await signup("recovery-replaced-owner@fixture.invalid");
  await db.updateTable("user").set({ role: "user" }).execute();
  let resetCalls = 0;
  await withRecoveryOwnerReplacement(
    async () => {
      await db
        .updateTable("recovery_claim")
        .set({ owner: randomUUID(), operationId: randomUUID() })
        .where("userId", "=", replaced.id)
        .execute();
    },
    () =>
      assert.rejects(
        completeRecovery({ code, email: replaced.email, password }, headers(), {
          resetPassword: async () => {
            resetCalls++;
          },
        }),
        /could not be completed/,
      ),
  );
  assert.equal(resetCalls, 0, "A replaced owner reached password reset");
  assert.equal(
    (
      await db
        .selectFrom("user")
        .select("role")
        .where("id", "=", replaced.id)
        .executeTakeFirstOrThrow()
    ).role,
    "user",
  );

  // An administrator appearing during Auth I/O fences zero-admin promotion.
  const intervening = await signup("intervening-admin@fixture.invalid");
  await db.updateTable("user").set({ role: "user" }).execute();
  await assert.rejects(
    completeRecovery(
      { code, email: intervening.email, password: "Intervening-password-42" },
      headers(),
      {
        resetPassword: async (...args) => {
          await resetRecoveryPassword(...args);
          await db
            .updateTable("user")
            .set({ role: "admin" })
            .where("id", "=", concurrent.id)
            .execute();
        },
      },
    ),
    (error: unknown) =>
      error instanceof DomainError &&
      /may already have changed/.test(error.message),
  );
  assert.equal(
    (
      await db
        .selectFrom("user")
        .select("role")
        .where("id", "=", intervening.id)
        .executeTakeFirstOrThrow()
    ).role,
    "user",
  );
  const recoverySetting = process.env.RECOVERY_CODE;
  delete process.env.RECOVERY_CODE;
  try {
    await assert.rejects(
      completeRecovery({ code, email: intervening.email, password }, headers()),
      (error: unknown) =>
        error instanceof DomainError && error.code === "NOT_FOUND",
    );
  } finally {
    process.env.RECOVERY_CODE = recoverySetting;
  }
  // One-time handoff reservation/claim semantics on the real auth endpoints.
  const secret = randomBytes(16).toString("hex"),
    ticket = randomBytes(16).toString("hex");
  const h = createHash("sha256").update(secret).digest("hex");
  const started = await auth(
    "/popup-handoff/start",
    { ticket, h, mode: "first-party" },
    200,
  );
  const popupCookie = started.headers
    .getSetCookie()
    .find((value) => value.startsWith("fl_popup_ticket="))!
    .split(";", 1)[0];
  assert(popupCookie);
  await auth("/popup-handoff/start", { ticket, h, mode: "first-party" }, 200, {
    cookie: popupCookie,
  });
  await auth("/popup-handoff/start", { ticket, h, mode: "first-party" }, 409);
  await auth("/popup-handoff/start", { ticket, h, mode: "embedded" }, 409, {
    cookie: popupCookie,
  });
  await auth(
    "/popup-handoff/claim",
    { ticket, secret: randomBytes(16).toString("hex") },
    403,
  );
  await auth("/popup-handoff/claim", { ticket, secret }, 202);
  const value = (await handoffStore.read(ticket))!;
  const expiry = (
    await db
      .selectFrom("auth_verification")
      .select(sql<string>`"expiresAt"::text`.as("expiresAt"))
      .where("id", "=", `popup-handoff:${ticket}`)
      .executeTakeFirstOrThrow()
  ).expiresAt;
  assert(await handoffStore.bind(ticket, value, { ...value, state: "done" }));
  assert(
    !(await handoffStore.bind(ticket, value, {
      ...value,
      state: "error",
      error: "access_denied",
    })),
  );
  assert.equal(
    (
      await db
        .selectFrom("auth_verification")
        .select(sql<string>`"expiresAt"::text`.as("expiresAt"))
        .where("id", "=", `popup-handoff:${ticket}`)
        .executeTakeFirstOrThrow()
    ).expiresAt,
    expiry,
  );
  const claims = await Promise.all(
    [0, 1].map(() =>
      getAuth().handler(
        new Request("https://fixture.invalid/api/auth/popup-handoff/claim", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ ticket, secret }),
        }),
      ),
    ),
  );
  assert.deepEqual(
    claims.map((response) => response.status).sort(),
    [200, 404],
  );
  await auth("/popup-handoff/claim", { ticket, secret }, 404);
  const expiredTicket = randomBytes(16).toString("hex");
  await auth(
    "/popup-handoff/start",
    { ticket: expiredTicket, h, mode: "embedded" },
    200,
  );
  await db
    .updateTable("auth_verification")
    .set({ expiresAt: sql`clock_timestamp()-interval '1 second'` })
    .where("id", "=", `popup-handoff:${expiredTicket}`)
    .execute();
  await auth("/popup-handoff/claim", { ticket: expiredTicket, secret }, 404);
  const throttled = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    throttled.push(
      await getAuth().handler(
        new Request("https://fixture.invalid/api/auth/sign-in/social", {
          method: "POST",
          headers: headers({ "x-forwarded-for": "192.0.2.250" }),
          body: JSON.stringify({ provider: "oidc" }),
        }),
      ),
    );
  }
  assert.deepEqual(
    throttled.map((response) => response.status),
    [400, 400, 400, 429],
  );
  assert(
    Number(throttled[3].headers.get("x-retry-after")) > 0 &&
      Number(throttled[3].headers.get("x-retry-after")) <= 10,
  );
  for (const path of [
    "/auth/popup?ticket=x",
    "https://fixture.invalid/auth/popup",
    "/%61uth/popup",
    "/api/auth/sign-in/social",
    "//fixture.invalid/api/auth/test",
  ]) {
    assert(isBlockedContentLink(path, "https://fixture.invalid"));
    assert(!clean(`<a href="${path}">unsafe link</a>`).includes("<a"));
  }
  assert(
    !isBlockedContentLink(
      "https://docs.example/api/example",
      "https://fixture.invalid",
    ),
  );
  console.log(
    JSON.stringify({
      oidc: "SDK PKCE/JWKS verification rejects wrong signature, issuer, audience, nonce and missing ID token",
      sdkRateLimit:
        "25 concurrent requests admit exactly three; retry deadline is 1–10 seconds with PG bigint timestamps",
      recovery:
        "code before identity, constant-time decoded-byte identity, fail-closed limits, reset/revocation, zero-admin repair, interrupted reset and promotion, one owner with minimum pool",
      adminReset: "non-admin credential only, single-use, pinned origin",
      handoff:
        "reservation retries, wrong secret, 202 pending, atomic single consumption, expiry and immutable deadline",
      links: "internal auth/API links removed; external links retained",
    }),
  );
}
void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const state = runtimeState();
    if (state.authDiscovery?.timer) clearInterval(state.authDiscovery.timer);
    state.authDiscovery?.controller?.abort();
    if (state.pool) await getPool().end();
    if (state.maintenancePool) await getPool(true).end();
  });
