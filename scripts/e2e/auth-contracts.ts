import { POST as authPost } from "../../app/api/auth/[...all]/route";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";
import { createFeedbackPostQuery } from "../../queries/create-feedback-post";
import { createCommentQuery } from "../../queries/create-comment";
import { updateFeedbackPostQuery } from "../../queries/update-feedback-post";
import { updateCommentQuery } from "../../queries/update-comment";
import { deleteFeedbackPostQuery } from "../../queries/delete-feedback-post";
import { deleteCommentQuery } from "../../queries/delete-comment";
import { createAdminInviteQuery } from "../../queries/create-admin-invite";
import { redeemAdminInviteQuery } from "../../queries/redeem-admin-invite";
import { sql } from "kysely";
import { db, getPool } from "../../db/db";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { getAuth } from "../../lib/auth/server";
import { completeSetup } from "../../lib/setup";
import { isSetupComplete } from "../../lib/setup-state";
import { createContext } from "../../lib/trpc";
import { POST as chat } from "../../app/api/chat/route";
import { POST as trpcPost } from "../../app/api/trpc/[trpc]/route";
import { POST as publicPost } from "../../app/api/feedback/create/route";
import { withSetupAckLoss } from "./setup-ack-fault";
import { reserveSignIn } from "../../lib/auth/sign-in-limit";
import { command } from "./run";

async function main() {
  const seeded = await migrateAndSeed();
  const state = runtimeState();
  state.authSecret = seeded.authSecret;
  state.setupComplete = false;
  const headers = (extra: Record<string, string> = {}) =>
    new Headers({
      host: "fixture.invalid",
      origin: "http://fixture.invalid",
      "content-type": "application/json",
      "x-forwarded-for": "192.0.2.30",
      ...extra,
    });
  const request = (
    path: string,
    body: unknown,
    extra: Record<string, string> = {},
  ) =>
    new Request(`http://fixture.invalid${path}`, {
      method: "POST",
      headers: headers(extra),
      body: JSON.stringify(body),
    });
  const auth = async (
    path: string,
    body: unknown,
    status: number,
    extra: Record<string, string> = {},
  ) => {
    const response = await authPost(request(`/api/auth${path}`, body, extra));
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    assert.equal(response.status, status, `${path}: ${JSON.stringify(json)}`);
    return { json, headers: response.headers };
  };
  const password = "Fixture-password-42";
  assert.equal(await isSetupComplete(), false);
  await auth(
    "/sign-up/email",
    { name: "Blocked", email: "blocked@fixture.invalid", password },
    403,
  );
  assert.equal((await chat(request("/api/chat", {}))).status, 403);
  assert.equal(
    (
      await publicPost(
        request("/api/feedback/create", { description: "blocked" }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await trpcPost(
        request("/api/trpc/createFeedbackPost", {
          json: { description: "blocked" },
        }),
      )
    ).status,
    403,
  );
  const secret = await db
    .selectFrom("instance_secret")
    .select("setupCode")
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  assert(secret.setupCode);
  const input = {
    code: secret.setupCode,
    platformTitle: "Auth fixture",
    name: "First admin",
    email: "admin@fixture.invalid",
    password,
  };
  await assert.rejects(
    completeSetup(
      { ...input, code: randomBytes(32).toString("hex") },
      headers(),
    ),
    /Setup could not/,
  );
  await sql`alter table rate_limit rename to rate_limit_fixture`.execute(db);
  try {
    await assert.rejects(
      completeSetup(input, headers()),
      /temporarily unavailable/,
    );
  } finally {
    await sql`alter table rate_limit_fixture rename to rate_limit`.execute(db);
  }
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      completeSetup(
        { ...input, code: "wrong" },
        headers({ "x-forwarded-for": "192.0.2.50" }),
      ),
      /Setup could not/,
    );
  await assert.rejects(
    completeSetup(input, headers({ "x-forwarded-for": "192.0.2.50" })),
    /Too many attempts/,
  );
  // Pre-existing accounts cannot be adopted, even with the correct setup code.
  const existing = await getAuth().api.signUpEmail({
    body: { name: "Existing", email: input.email, password },
  });
  await assert.rejects(
    completeSetup(input, headers({ "x-forwarded-for": "192.0.2.51" })),
    /Setup could not/,
  );
  assert.equal(
    (
      await db
        .selectFrom("user")
        .select("role")
        .where("id", "=", existing.user.id)
        .executeTakeFirstOrThrow()
    ).role,
    "user",
  );
  await db.deleteFrom("user").where("id", "=", existing.user.id).execute();
  // Force a post-signup transaction failure. Compensation must run after rollback
  // and remove the new account/session without consuming the one-time code.
  await sql`create function fixture_setup_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture'; end $$`.execute(
    db,
  );
  await sql`create trigger fixture_auth_failure before insert on auth_session for each row execute function fixture_setup_failure()`.execute(
    db,
  );
  try {
    await assert.rejects(
      completeSetup(
        { ...input, email: "session-failure@fixture.invalid" },
        headers({ "x-forwarded-for": "192.0.2.53" }),
      ),
      /Setup could not/,
    );
  } finally {
    await sql`drop trigger fixture_auth_failure on auth_session`.execute(db);
  }
  assert.equal(
    await db
      .selectFrom("user")
      .select("id")
      .where("email", "=", "session-failure@fixture.invalid")
      .executeTakeFirst(),
    undefined,
    "Failed auth signup left an orphaned identity",
  );
  await sql`create trigger fixture_setup_failure before update on settings for each row execute function fixture_setup_failure()`.execute(
    db,
  );
  try {
    await withSetupAckLoss("ROLLBACK", () =>
      assert.rejects(
        completeSetup(
          { ...input, email: "rollback@fixture.invalid" },
          headers({ "x-forwarded-for": "192.0.2.52" }),
        ),
        /Setup could not/,
      ),
    );
  } finally {
    await sql`drop trigger fixture_setup_failure on settings`.execute(db);
    await sql`drop function fixture_setup_failure()`.execute(db);
  }
  assert.equal(
    await db
      .selectFrom("user")
      .select("id")
      .where("email", "=", "rollback@fixture.invalid")
      .executeTakeFirst(),
    undefined,
  );
  assert.equal(await isSetupComplete(), false);
  const concurrent = await withSetupAckLoss("COMMIT", () =>
    Promise.allSettled(
      [0, 1].map((index) =>
        completeSetup(
          { ...input, email: `setup-${index}@fixture.invalid` },
          headers({ "x-forwarded-for": `192.0.2.${40 + index}` }),
        ),
      ),
    ),
  );
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  const admin = await db
    .selectFrom("user")
    .selectAll()
    .where("role", "=", "admin")
    .execute();
  assert.equal(admin.length, 1);
  assert.equal(
    concurrent.find((r) => r.status === "fulfilled")?.value.userId,
    admin[0].id,
    "The committed setup admin must survive a lost COMMIT acknowledgement",
  );
  assert.equal(
    (await db.selectFrom("feedback").select("id").execute()).length,
    0,
  );
  assert.equal(
    (
      await db
        .selectFrom("instance_secret")
        .select("setupCode")
        .where("id", "=", 1)
        .executeTakeFirstOrThrow()
    ).setupCode,
    null,
  );
  await assert.rejects(completeSetup(input, headers()), /Setup could not/);
  await db.deleteFrom("auth_rate_limit").execute();
  const first = await auth(
    "/sign-in/email",
    { email: admin[0].email, password },
    200,
  );
  assert.equal(first.headers.get("set-auth-token"), null);
  assert(
    !first.headers
      .get("access-control-expose-headers")
      ?.toLowerCase()
      .includes("set-auth-token"),
  );
  const cookie = first.headers
    .getSetCookie()
    .find((x) => x.startsWith("better-auth.session_token="))
    ?.split(";", 1)[0];
  assert(cookie);
  const context = await createContext({
    req: request("/api/trpc", {}, { cookie }),
  });
  assert.equal(context.canAdminister, true);
  assert.equal(
    (
      await createContext({
        req: request(
          "/api/trpc",
          {},
          { cookie, "x-feedbackland-scope": "embedded" },
        ),
      })
    ).userId,
    null,
  );
  const { GET: authGet } = await import("../../app/api/auth/[...all]/route");
  assert.equal(
    await (
      await authGet(
        new Request("http://fixture.invalid/api/auth/get-session", {
          headers: headers({ cookie, "x-feedbackland-scope": "embedded" }),
        }),
      )
    ).json(),
    null,
  );
  const embedded = await auth(
    "/sign-in/email",
    { email: admin[0].email, password },
    200,
    { "x-feedbackland-scope": "embedded" },
  );
  const token = embedded.headers.get("set-auth-token");
  assert(token);
  assert.equal(embedded.headers.get("set-cookie"), null);
  const credentials: Record<string, string>[] = [
    { authorization: `Bearer ${token}` },
    { cookie: `better-auth.session_token=${token}` },
  ];
  for (const credential of credentials) {
    const ctx = await createContext({
      req: request("/api/trpc", {}, credential),
    });
    assert.equal(ctx.userId, admin[0].id);
    assert.equal(ctx.canAdminister, false);
    assert.equal(ctx.session?.session.scope, "embedded");
    assert.equal(
      (await chat(request("/api/chat", {}, credential))).status,
      403,
    );
    assert.equal(
      (
        await trpcPost(
          request(
            "/api/trpc/updateSettings",
            { json: { platformTitle: "Forbidden", expectedRevision: "2" } },
            credential,
          ),
        )
      ).status,
      403,
    );
  }
  await auth("/update-session", { scope: "first-party" }, 400, {
    authorization: `Bearer ${token}`,
  });
  const user = await auth(
    "/sign-up/email",
    {
      name: "N".repeat(500),
      email: "user@fixture.invalid",
      password: `  ${password}  `,
      role: "admin",
      image: "https://tracking.invalid/pixel",
    },
    200,
    { "x-forwarded-for": "192.0.2.31" },
  );
  assert.equal(user.json.user.role, "user");
  assert.equal(user.json.user.image, null);
  assert.equal(user.json.user.name.length, 100);
  const userCookie = user.headers
    .getSetCookie()
    .find((x) => x.startsWith("better-auth.session_token="))
    ?.split(";", 1)[0];
  assert(userCookie);
  await auth("/update-user", { role: "admin" }, 400, { cookie: userCookie });
  await auth("/update-user", { image: "https://tracking.invalid/pixel" }, 400, {
    cookie: userCookie,
  });
  await auth(
    "/sign-in/email",
    { email: "user@fixture.invalid", password },
    200,
    { "x-forwarded-for": "192.0.2.32" },
  );
  const csrfCases: Record<string, string>[] = [
    { "content-type": "multipart/form-data; boundary=fixture" },
    { "sec-fetch-site": "same-site" },
  ];
  for (const extra of csrfCases) {
    assert.equal(
      (
        await trpcPost(
          request("/api/trpc/setAllActivitiesSeen", {}, { cookie, ...extra }),
        )
      ).status,
      extra["content-type"] ? 415 : 403,
    );
    assert.equal(
      (await chat(request("/api/chat", {}, { cookie, ...extra }))).status,
      extra["content-type"] ? 415 : 403,
    );
  }
  const rpc = async (
    path: string,
    body: unknown,
    status: number,
    credential: Record<string, string>,
  ) => {
    const response = await trpcPost(
      request("/api/trpc/" + path, { json: body }, credential),
    );
    const json = await response.json();
    assert.equal(response.status, status, path + ": " + JSON.stringify(json));
    return json.result?.data?.json;
  };
  // Bare database tokens never authenticate; a valid signed bearer takes
  // precedence over a cookie even after that bearer has been revoked.
  const doomed = await auth(
    "/sign-in/email",
    { email: admin[0].email, password },
    200,
    { "x-feedbackland-scope": "embedded", "x-forwarded-for": "192.0.2.63" },
  );
  const doomedToken = doomed.headers.get("set-auth-token");
  assert(doomedToken);
  const doomedContext = await createContext({
    req: request("/api/trpc", {}, { authorization: "Bearer " + doomedToken }),
  });
  await db
    .deleteFrom("auth_session")
    .where("id", "=", doomedContext.sessionId!)
    .execute();
  assert.equal(
    (
      await createContext({
        req: request(
          "/api/trpc",
          {},
          { cookie, authorization: "Bearer " + doomedToken },
        ),
      })
    ).userId,
    null,
  );
  assert.equal(
    (await createContext({ req: request("/api/trpc", {}, { cookie }) }))
      .canAdminister,
    true,
  );
  const embeddedRow = await db
    .selectFrom("auth_session")
    .selectAll()
    .where("scope", "=", "embedded")
    .executeTakeFirstOrThrow();
  for (const credential of <Record<string, string>[]>[
    { authorization: "Bearer " + embeddedRow.token },
    { cookie: "better-auth.session_token=" + embeddedRow.token },
  ]) {
    assert.equal(
      (await createContext({ req: request("/api/trpc", {}, credential) }))
        .userId,
      null,
    );
  }
  assert.equal(
    (
      await createContext({
        req: request(
          "/api/trpc",
          {},
          { cookie, authorization: "Bearer invalid" },
        ),
      })
    ).canAdminister,
    true,
  );
  const agedLogin = await auth(
    "/sign-in/email",
    { email: admin[0].email, password },
    200,
    { "x-forwarded-for": "192.0.2.61" },
  );
  const agedCookie = agedLogin.headers.getSetCookie()[0].split(";", 1)[0];
  const agedContext = await createContext({
    req: request("/api/trpc", {}, { cookie: agedCookie }),
  });
  await db
    .updateTable("auth_session")
    .set({ createdAt: new Date(Date.now() - 8 * 86400_000) })
    .where("id", "=", agedContext.sessionId!)
    .execute();
  assert.equal(
    (
      await createContext({
        req: request("/api/trpc", {}, { cookie: agedCookie }),
      })
    ).canAdminister,
    false,
  );
  assert.equal(
    (await chat(request("/api/chat", {}, { cookie: agedCookie }))).status,
    403,
  );
  const post = await createFeedbackPostQuery({
    description: "Other user's content",
    authorId: user.json.user.id,
  });
  const comment = await createCommentQuery({
    postId: post.id,
    parentCommentId: null,
    content: "Other comment",
    authorId: user.json.user.id,
  });
  const edits = [
    [
      "updateFeedbackPost",
      {
        postId: post.id,
        title: "Override",
        description: "Override",
        expectedRevision: "1",
      },
    ],
    ["deleteFeedbackPost", { postId: post.id }],
    [
      "updateComment",
      { commentId: comment.id, content: "Override", expectedRevision: "1" },
    ],
    ["deleteComment", { commentId: comment.id }],
  ] as const;
  for (const credential of [...credentials, { cookie: agedCookie }])
    for (const [path, body] of edits) await rpc(path, body, 403, credential);
  for (const credential of [...credentials, { cookie: agedCookie }]) {
    for (const path of [
      "generateInsights",
      "deleteAdminInvite",
      "createAdminInvite",
      "deleteAdmin",
      "setInsightStatus",
      "setAllActivitiesSeen",
      "setActivitiesSeen",
      "updateFeedbackPostStatus",
    ])
      await rpc(path, {}, 403, credential);
    for (const path of [
      "getSettings",
      "getAdmins",
      "getActivityFeed",
      "getInsights",
      "getActivityFeedMetaData",
      "getFeedbackPostCount",
    ]) {
      const { GET } = await import("../../app/api/trpc/[trpc]/route");
      const response = await GET(
        new Request("http://fixture.invalid/api/trpc/" + path, {
          headers: headers(credential),
        }),
      );
      assert.equal(response.status, 403, path);
    }
    const ownPost = await createFeedbackPostQuery({
      description: "Scope does not remove authorship",
      authorId: admin[0].id,
    });
    const ownComment = await createCommentQuery({
      postId: ownPost.id,
      parentCommentId: null,
      content: "Own comment",
      authorId: admin[0].id,
    });
    await rpc(
      "updateFeedbackPost",
      {
        postId: ownPost.id,
        title: "Own edit",
        description: "Own edit",
        expectedRevision: "1",
      },
      200,
      credential,
    );
    await rpc(
      "updateComment",
      { commentId: ownComment.id, content: "Own edit", expectedRevision: "1" },
      200,
      credential,
    );
    await rpc("deleteComment", { commentId: ownComment.id }, 200, credential);
    await rpc("deleteFeedbackPost", { postId: ownPost.id }, 200, credential);
  }
  // Both ordinary authors and a young first-party admin retain valid rights.
  await rpc(
    "updateFeedbackPost",
    {
      postId: post.id,
      title: "Own edit",
      description: "Own edit",
      expectedRevision: "1",
    },
    200,
    { cookie: userCookie },
  );
  await rpc(
    "updateComment",
    { commentId: comment.id, content: "Admin edit", expectedRevision: "1" },
    200,
    { cookie },
  );
  await rpc("deleteComment", { commentId: comment.id }, 200, {
    cookie: userCookie,
  });
  await rpc("deleteFeedbackPost", { postId: post.id }, 200, { cookie });
  // A context resolved before revocation cannot authorize the final write.
  const target = await createFeedbackPostQuery({
    description: "Revocation target",
    authorId: user.json.user.id,
  });
  const targetComment = await createCommentQuery({
    postId: target.id,
    parentCommentId: null,
    content: "Revocation comment",
    authorId: user.json.user.id,
  });
  const staleActor = { userId: admin[0].id, sessionId: context.sessionId! };
  await db
    .updateTable("user")
    .set({ role: "user" })
    .where("id", "=", admin[0].id)
    .execute();
  const staleWrites = () => [
    () =>
      updateFeedbackPostQuery({
        ...staleActor,
        postId: target.id,
        title: "Invalid",
        description: "Invalid",
        expectedRevision: "1",
      }),
    () => deleteFeedbackPostQuery({ ...staleActor, postId: target.id }),
    () =>
      updateCommentQuery({
        ...staleActor,
        commentId: targetComment.id,
        content: "Invalid",
        expectedRevision: "1",
      }),
    () => deleteCommentQuery({ ...staleActor, commentId: targetComment.id }),
  ];
  for (const write of staleWrites())
    await assert.rejects(write(), /UNAUTHORIZED/);
  await db
    .updateTable("user")
    .set({ role: "admin" })
    .where("id", "=", admin[0].id)
    .execute();
  const own = await createFeedbackPostQuery({
    description: "Own revoked target",
    authorId: admin[0].id,
  });
  await db
    .deleteFrom("auth_session")
    .where("id", "=", staleActor.sessionId)
    .execute();
  for (const write of staleWrites()) await assert.rejects(write(), /Sign in/);
  await assert.rejects(
    updateFeedbackPostQuery({
      ...staleActor,
      postId: own.id,
      title: "Invalid",
      description: "Invalid",
      expectedRevision: "1",
    }),
    /Sign in/,
  );
  // Invite redemption requires the same young, unexpired first-party credential.
  const userContext = await createContext({
    req: request("/api/trpc", {}, { cookie: userCookie }),
  });
  const userActor = {
    userId: user.json.user.id,
    sessionId: userContext.sessionId!,
  };
  const fresh = await auth(
    "/sign-in/email",
    { email: admin[0].email, password },
    200,
    { "x-forwarded-for": "192.0.2.62" },
  );
  const freshCookie = fresh.headers.getSetCookie()[0].split(";", 1)[0];
  const freshContext = await createContext({
    req: request("/api/trpc", {}, { cookie: freshCookie }),
  });
  const invite = await createAdminInviteQuery({
    userId: admin[0].id,
    sessionId: freshContext.sessionId!,
    email: user.json.user.email,
  });
  await db
    .updateTable("admin_invites")
    .set({ email: "wrong@fixture.invalid" })
    .where("id", "=", invite.id)
    .execute();
  await assert.rejects(
    redeemAdminInviteQuery({ ...userActor, adminInviteToken: invite.token }),
    /UNAUTHORIZED/,
  );
  await db
    .updateTable("admin_invites")
    .set({ email: user.json.user.email, expiresAt: new Date(0) })
    .where("id", "=", invite.id)
    .execute();
  await assert.rejects(
    redeemAdminInviteQuery({ ...userActor, adminInviteToken: invite.token }),
    /not found/,
  );
  await db
    .updateTable("admin_invites")
    .set({ expiresAt: new Date(Date.now() + 60_000) })
    .where("id", "=", invite.id)
    .execute();
  for (const credential of credentials)
    await rpc(
      "redeemAdminInvite",
      { adminInviteToken: invite.token },
      401,
      credential,
    );
  assert.equal(
    await redeemAdminInviteQuery({
      ...userActor,
      adminInviteToken: invite.token,
    }),
    true,
  );
  await assert.rejects(
    redeemAdminInviteQuery({ ...userActor, adminInviteToken: invite.token }),
    /not found/,
  );
  // Name-only updates preserve provider avatars; explicit image clearing fails.
  await db
    .updateTable("user")
    .set({ image: "https://provider.fixture.invalid/avatar" })
    .where("id", "=", userActor.userId)
    .execute();
  await auth("/update-user", { name: "  Updated name  " }, 200, {
    cookie: userCookie,
  });
  const profile = await db
    .selectFrom("user")
    .select(["name", "image"])
    .where("id", "=", userActor.userId)
    .executeTakeFirstOrThrow();
  assert.deepEqual(profile, {
    name: "Updated name",
    image: "https://provider.fixture.invalid/avatar",
  });
  await auth("/update-user", { image: null }, 400, { cookie: userCookie });
  await auth("/delete-user", { password }, 404, { cookie: freshCookie });
  // Rolling expiry extends authentication without extending admin's absolute age.
  for (const credential of <Record<string, string>[]>[
    { cookie: freshCookie },
    { authorization: "Bearer " + token },
  ]) {
    const ctx = await createContext({
      req: request("/api/trpc", {}, credential),
    });
    await db
      .updateTable("auth_session")
      .set({
        expiresAt: new Date(Date.now() + 2 * 86400_000),
        updatedAt: new Date(Date.now() - 2 * 86400_000),
      })
      .where("id", "=", ctx.sessionId!)
      .execute();
    const response = await getAuth().handler(
      new Request("http://fixture.invalid/api/auth/get-session", {
        headers: headers(credential),
      }),
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert(
      new Date(data.session.expiresAt).getTime() > Date.now() + 20 * 86400_000,
    );
    assert.equal(data.session.id, ctx.sessionId);
    assert.equal(data.session.scope, ctx.session?.session.scope);
    if (credential.authorization) {
      assert.equal(response.headers.get("set-cookie"), null);
      assert(response.headers.get("set-auth-token"));
    } else {
      assert(response.headers.get("set-cookie"));
      assert.equal(response.headers.get("set-auth-token"), null);
    }
  }
  // Password replacement must preserve embedded scope and revoke siblings.
  const changed = await auth(
    "/change-password",
    {
      currentPassword: password,
      newPassword: "Changed-password-42",
      revokeOtherSessions: true,
    },
    200,
    { authorization: "Bearer " + token },
  );
  assert.equal(changed.headers.get("set-cookie"), null);
  const replacement = changed.headers.get("set-auth-token");
  assert(replacement);
  assert.equal(
    (
      await createContext({
        req: request(
          "/api/trpc",
          {},
          { authorization: "Bearer " + replacement },
        ),
      })
    ).session?.session.scope,
    "embedded",
  );
  assert.equal(
    (
      await createContext({
        req: request(
          "/api/trpc",
          {},
          { cookie: freshCookie, authorization: "Bearer " + token },
        ),
      })
    ).userId,
    null,
  );
  // Ordinary embedded sign-out revokes its token without changing browser cookies.
  await auth("/sign-out", {}, 200, { authorization: "Bearer " + replacement });
  assert.equal(
    (
      await createContext({
        req: request(
          "/api/trpc",
          {},
          { authorization: "Bearer " + replacement },
        ),
      })
    ).userId,
    null,
  );
  // Two independent processes must share the admission bound, not a JS mutex.
  const replicas = await Promise.all(
    [0, 1].map(() =>
      command(
        process.execPath,
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/e2e/sign-in-limit-worker.ts",
          "replicas@fixture.invalid",
        ],
        {
          env: {
            DATABASE_URL: process.env.DATABASE_URL,
            DATABASE_POOL_MAX: "2",
          },
        },
      ),
    ),
  );
  assert.equal(
    replicas.reduce((n, result) => n + JSON.parse(result).admitted, 0),
    10,
  );
  // Reserve before hashing: concurrent distributed guesses cannot overshoot.
  await auth(
    "/sign-up/email",
    {
      name: "Concurrent fixture",
      email: "burst@fixture.invalid",
      password,
    },
    200,
    { "x-forwarded-for": "192.0.2.100" },
  );
  for (let i = 0; i < 12; i++)
    await auth(
      "/sign-in/email",
      { email: "burst@fixture.invalid", password },
      200,
      { "x-forwarded-for": `192.0.2.${101 + i}` },
    );
  await auth("/sign-in/email", { email: "not-an-email", password }, 400, {
    "x-forwarded-for": "192.0.2.140",
  });
  const invalidBucket = await db
    .selectFrom("rate_limit")
    .select("count")
    .where(
      "key",
      "=",
      "sign-in:email:" +
        createHash("sha256").update("not-an-email").digest("hex"),
    )
    .executeTakeFirstOrThrow();
  assert.equal(
    invalidBucket.count,
    0,
    "Validation failures must refund their reservation",
  );
  const burst = await Promise.all(
    Array.from({ length: 25 }, async (_, i) => {
      const r = await authPost(
        request(
          "/api/auth/sign-in/email",
          {
            email: "burst@fixture.invalid",
            password: `Wrong-password-${i}-42`,
          },
          { "x-forwarded-for": `198.51.100.${100 + i}` },
        ),
      );
      return r.status;
    }),
  );
  assert.equal(burst.filter((s) => s === 401).length, 10);
  assert.equal(burst.filter((s) => s === 429).length, 15);
  await auth(
    "/sign-in/email",
    { email: "burst@fixture.invalid", password },
    429,
    { "x-forwarded-for": "192.0.2.130" },
  );
  // A late successful request must not refund a reservation in a newer window.
  const leaseEmail = "lease@fixture.invalid";
  const leaseKey =
    "sign-in:email:" + createHash("sha256").update(leaseEmail).digest("hex");
  const oldPermit = await reserveSignIn(leaseEmail);
  assert(oldPermit);
  await sql`update rate_limit set "windowStart"=clock_timestamp()-interval '16 minutes', count=10 where key=${leaseKey}`.execute(
    db,
  );
  const currentPermit = await reserveSignIn(leaseEmail);
  assert(currentPermit);
  await oldPermit.complete(false);
  const leaseCount = async () =>
    (
      await db
        .selectFrom("rate_limit")
        .select("count")
        .where("key", "=", leaseKey)
        .executeTakeFirstOrThrow()
    ).count;
  assert.equal(await leaseCount(), 1);
  await currentPermit.complete(false);
  await currentPermit.complete(false);
  assert.equal(
    await leaseCount(),
    0,
    "A reservation may be refunded only once",
  );
  await sql`update rate_limit set "windowStart"=date_trunc('second',clock_timestamp())-interval '1 second'+interval '0.123456 seconds' where key=${leaseKey}`.execute(
    db,
  );
  const precise = await reserveSignIn(leaseEmail);
  assert(precise);
  await precise.complete(false);
  assert.equal(
    await leaseCount(),
    0,
    "Refunds must preserve timestamp microseconds",
  );
  // Only failed sign-in attempts retain the normalized hashed email bucket.
  await db.deleteFrom("auth_rate_limit").execute();
  for (let i = 0; i < 10; i++)
    await auth(
      "/sign-in/email",
      { email: "user@fixture.invalid", password: "Wrong-password-42" },
      401,
      { "x-forwarded-for": "198.51.100." + (i + 1) },
    );
  await auth(
    "/sign-in/email",
    { email: "USER@fixture.invalid", password },
    429,
    { "x-forwarded-for": "198.51.100.20" },
  );
  const emailBucket = await db
    .selectFrom("rate_limit")
    .selectAll()
    .where(
      "key",
      "=",
      "sign-in:email:" +
        createHash("sha256").update("user@fixture.invalid").digest("hex"),
    )
    .executeTakeFirstOrThrow();
  assert.equal(emailBucket.count, 10);
  assert(!emailBucket.key.includes("@"));
  await db.deleteFrom("auth_rate_limit").execute();
  for (let i = 0; i < 10; i++)
    await auth(
      "/sign-in/email",
      { email: "ip-" + i + "@fixture.invalid", password },
      401,
      { "x-forwarded-for": "203.0.113.70, 10.0.0.1, 10.0.0.2" },
    );
  await auth(
    "/sign-in/email",
    { email: "ip-new@fixture.invalid", password },
    429,
    { "x-forwarded-for": "203.0.113.70, 10.0.0.1, 10.0.0.2" },
  );
  await auth(
    "/sign-in/email",
    { email: "ip-other@fixture.invalid", password },
    401,
    { "x-forwarded-for": "203.0.113.71, 10.0.0.1, 10.0.0.2" },
  );
  await auth(
    "/sign-in/email",
    { email: "origin@fixture.invalid", password },
    403,
    { origin: "http://foreign.invalid", "x-forwarded-for": "203.0.113.72" },
  );
  await sql`alter table rate_limit rename to rate_limit_fixture`.execute(db);
  try {
    await auth(
      "/sign-in/email",
      { email: user.json.user.email, password },
      200,
      { "x-forwarded-for": "203.0.113.73" },
    );
  } finally {
    await sql`alter table rate_limit_fixture rename to rate_limit`.execute(db);
  }
  console.log(
    JSON.stringify({
      setup:
        "serialized, fail-closed, code consumed; lost COMMIT/ROLLBACK acknowledgements reconciled",
      minimumPool: 2,
      cookieBearerSeparation: "passed",
      immutableScope: "passed",
      userInputs: "passed",
      csrf: "passed",
      finalWriteRevalidation: "four paths, role removal and session revocation",
      expiredAdmin: "ordinary author only",
      invites: "scope, email, expiry, reuse",
      rollingAndPasswordReplacement: "scope preserved",
      signInLimits:
        "atomic email reservations, successful refunds, fenced windows and trusted multi-hop IP",
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
    if (state.pool) await getPool().end();
    if (state.maintenancePool) await getPool(true).end();
  });
