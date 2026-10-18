import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../../db/db";
import { deleteAdminQuery } from "../../queries/delete-admin";
import { redeemAdminInviteQuery } from "../../queries/redeem-admin-invite";
import { createCommentQuery } from "../../queries/create-comment";
import { canAdminister } from "../../lib/auth/authorization";
import { createFeedbackPostQuery } from "../../queries/create-feedback-post";
import { createAdminInviteQuery } from "../../queries/create-admin-invite";
import { deleteAdminInviteQuery } from "../../queries/delete-admin-invite";

export async function seedUser(
  id: string,
  role = "user",
  scope = "first-party",
  ageDays = 0,
) {
  await db
    .insertInto("user")
    .values({
      id,
      name: id,
      email: `${id}@fixture.invalid`,
      emailVerified: false,
      role,
    })
    .execute();
  const sessionId = randomUUID();
  await db
    .insertInto("auth_session")
    .values({
      id: sessionId,
      userId: id,
      token: randomUUID(),
      scope,
      createdAt: new Date(Date.now() - ageDays * 86400_000),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
    })
    .execute();
  return { userId: id, sessionId };
}
export async function membershipAndReplies() {
  const first = await seedUser("admin-a", "admin"),
    second = await seedUser("admin-b", "admin");
  const results = await Promise.allSettled([
    deleteAdminQuery({ ...first, adminId: second.userId }),
    deleteAdminQuery({ ...second, adminId: first.userId }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const admins = await db
    .selectFrom("user")
    .select("id")
    .where("role", "=", "admin")
    .execute();
  assert.equal(admins.length, 1);
  const surviving = admins[0].id === first.userId ? first : second;
  await assert.rejects(
    deleteAdminQuery({ ...surviving, adminId: surviving.userId }),
    /LAST_ADMIN/,
  );
  for (const actor of [
    await seedUser("embedded", "admin", "embedded"),
    await seedUser("old", "admin", "first-party", 8),
    await seedUser("ordinary"),
  ])
    assert.equal(await canAdminister(db, actor), false);
  const invited = await seedUser("invited");
  const invite = await createAdminInviteQuery({
    ...surviving,
    email: "other@fixture.invalid",
  });
  assert(invite.expiresAt.getTime() > Date.now() + 6 * 86400_000);
  const disposable = await createAdminInviteQuery({
    ...surviving,
    email: "delete@fixture.invalid",
  });
  await assert.rejects(
    deleteAdminInviteQuery({
      ...surviving,
      sessionId: "invalid-session",
      adminInviteId: disposable.id,
    }),
    /UNAUTHORIZED/,
  );
  await deleteAdminInviteQuery({ ...surviving, adminInviteId: disposable.id });
  await assert.rejects(
    redeemAdminInviteQuery({ ...invited, adminInviteToken: invite.token }),
    /UNAUTHORIZED/,
  );
  await db
    .updateTable("admin_invites")
    .set({
      email: "invited@fixture.invalid",
      expiresAt: new Date(Date.now() - 1000),
    })
    .where("id", "=", invite.id)
    .execute();
  await assert.rejects(
    redeemAdminInviteQuery({ ...invited, adminInviteToken: invite.token }),
  );
  await db
    .updateTable("admin_invites")
    .set({ expiresAt: new Date(Date.now() + 60_000) })
    .where("id", "=", invite.id)
    .execute();
  assert.equal(
    await redeemAdminInviteQuery({
      ...invited,
      adminInviteToken: invite.token,
    }),
    true,
  );
  await assert.rejects(
    redeemAdminInviteQuery({ ...invited, adminInviteToken: invite.token }),
  );
  const post = await createFeedbackPostQuery({
    description: "Parent fixture.",
    authorId: invited.userId,
  });
  const other = await createFeedbackPostQuery({
    description: "Other fixture.",
    authorId: null,
  });
  let parent: string | null = null;
  for (let depth = 0; depth <= 8; depth++) {
    const row = await createCommentQuery({
      postId: post.id,
      parentCommentId: parent,
      content: `Depth ${depth}`,
      authorId: invited.userId,
    });
    parent = row.id;
  }
  await assert.rejects(
    createCommentQuery({
      postId: post.id,
      parentCommentId: parent,
      content: "Too deep",
      authorId: invited.userId,
    }),
    /INVALID_REPLY_PARENT/,
  );
  await assert.rejects(
    createCommentQuery({
      postId: other.id,
      parentCommentId: parent,
      content: "Wrong post",
      authorId: invited.userId,
    }),
    /INVALID_REPLY_PARENT/,
  );
  await assert.rejects(
    db
      .insertInto("comment")
      .values({
        postId: other.id,
        parentCommentId: parent,
        content: "raw cross-post",
        plainText: "raw",
        moderationState: "disabled",
      })
      .execute(),
    (error: unknown) => (error as { code: string }).code === "23503",
  );
  const ownId = randomUUID();
  await assert.rejects(
    db
      .insertInto("comment")
      .values({
        id: ownId,
        postId: post.id,
        parentCommentId: ownId,
        content: "self",
        plainText: "self",
        moderationState: "disabled",
      })
      .execute(),
    (error: unknown) => (error as { code: string }).code === "23514",
  );
  // Erasure preserves other people's content and nulls authorship.
  await db.deleteFrom("user").where("id", "=", invited.userId).execute();
  assert.equal(
    (
      await db
        .selectFrom("feedback")
        .select("authorId")
        .where("id", "=", post.id)
        .executeTakeFirstOrThrow()
    ).authorId,
    null,
  );
  assert.equal(
    (
      await db
        .selectFrom("comment")
        .select("authorId")
        .where("id", "=", parent)
        .executeTakeFirstOrThrow()
    ).authorId,
    null,
  );
  return surviving;
}
