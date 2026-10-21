import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { db } from "../../db/db";
import type { Actor } from "../../lib/auth/authorization";
import { publicProcedure, router, type RequestContext } from "../../lib/trpc";
import { appRouter } from "../../trpc";
import { createFeedbackPostQuery } from "../../queries/create-feedback-post";
import { createCommentQuery } from "../../queries/create-comment";
import { seedUser } from "./v19-auth-invariants";
import {
  escapeFeedbackText,
  MAX_FEEDBACK_TEXT_LENGTH,
} from "../../lib/feedback-text";

export async function rpcContracts(actor: Actor) {
  const context: RequestContext = {
    ...actor,
    sessionId: actor.sessionId ?? null,
    userEmail: null,
    canAdminister: true,
    ip: "192.0.2.52",
  };
  const call = async (
    path: string,
    input: unknown,
    status: number,
    code?: string,
    ctx = context,
  ) => {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      router: appRouter,
      req: new Request(`http://fixture.invalid/api/trpc/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input }),
      }),
      createContext: () => ctx,
    });
    const body = await response.json();
    assert.equal(response.status, status, `${path}: ${JSON.stringify(body)}`);
    if (code) assert.equal(body.error.json.data.code, code, path);
    return body.result?.data?.json;
  };
  const settings = await db
    .selectFrom("settings")
    .select("revision")
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  const save = {
    expectedRevision: settings.revision,
    platformTitle: "RPC settings",
  };
  const first = await call("updateSettings", save, 200);
  await call("updateSettings", save, 409, "CONFLICT");
  const second = await call(
    "updateSettings",
    { ...save, expectedRevision: first.revision },
    200,
  );
  assert.equal(BigInt(second.revision), BigInt(first.revision) + 1n);
  await call(
    "updateSettings",
    { ...save, expectedRevision: "9223372036854775808" },
    400,
    "BAD_REQUEST",
  );
  await call("updateSettings", save, 401, "UNAUTHORIZED", {
    ...context,
    sessionId: "invalid-session",
  });

  const post = await createFeedbackPostQuery({
    description: "RPC post",
    authorId: actor.userId,
  });
  const edit = {
    postId: post.id,
    title: "RPC edit",
    description: "Revised",
    expectedRevision: "1",
  };
  await call("updateFeedbackPost", edit, 200);
  await call("updateFeedbackPost", edit, 409, "CONFLICT");
  await call(
    "updateFeedbackPost",
    { ...edit, expectedRevision: "2", description: '<img src="x">' },
    400,
    "BAD_REQUEST",
  );
  const stranger = await seedUser("rpc-stranger");
  await call(
    "updateFeedbackPost",
    { ...edit, expectedRevision: "2" },
    403,
    "FORBIDDEN",
    {
      ...context,
      ...stranger,
      canAdminister: false,
    },
  );
  const comment = await createCommentQuery({
    postId: post.id,
    authorId: actor.userId,
    parentCommentId: null,
    content: "RPC comment",
  });
  const commentEdit = {
    commentId: comment.id,
    content: "Revised",
    expectedRevision: "1",
  };
  await call("updateComment", commentEdit, 200);
  await call("updateComment", commentEdit, 409, "CONFLICT");
  await call(
    "createComment",
    { postId: post.id, parentCommentId: randomUUID(), content: "Bad parent" },
    400,
    "BAD_REQUEST",
  );
  await call("updateSettings", save, 401, "UNAUTHORIZED", {
    ...context,
    userId: null,
    sessionId: null,
    canAdminister: false,
  });
  await call(
    "redeemAdminInvite",
    { adminInviteToken: randomUUID() },
    404,
    "NOT_FOUND",
  );

  const anonymous: RequestContext = {
    ...context,
    userId: null,
    sessionId: null,
    canAdminister: false,
  };
  for (const description of [
    "&".repeat(MAX_FEEDBACK_TEXT_LENGTH),
    "<".repeat(MAX_FEEDBACK_TEXT_LENGTH),
    ">".repeat(MAX_FEEDBACK_TEXT_LENGTH),
    "X\n".repeat(MAX_FEEDBACK_TEXT_LENGTH / 2),
    "😀".repeat(MAX_FEEDBACK_TEXT_LENGTH / 2),
    '<img src="literal text, not an attachment">',
  ]) {
    const created = await call(
      "createFeedbackPost",
      { description },
      200,
      undefined,
      anonymous,
    );
    assert.equal(created.description, escapeFeedbackText(description));
    assert.equal(created.plainText, description.replace(/\s+/g, " ").trim());
    const stored = await db
      .selectFrom("feedback")
      .select(["description", "plainText"])
      .where("id", "=", created.id)
      .executeTakeFirstOrThrow();
    assert.equal(stored.description, created.description);
    assert.equal(stored.plainText, created.plainText);
  }
  await call(
    "createFeedbackPost",
    { description: "&".repeat(MAX_FEEDBACK_TEXT_LENGTH + 1) },
    400,
    "BAD_REQUEST",
    anonymous,
  );
  await call(
    "createFeedbackPost",
    { description: " \n\t " },
    400,
    "BAD_REQUEST",
    anonymous,
  );
  await assert.rejects(
    createFeedbackPostQuery({ description: '<img src="x">', authorId: null }),
    /Text-only/,
  );

  // An unexpected error with the same message must retain its 500 contract.
  const unexpected = router({
    failure: publicProcedure.mutation(() => {
      throw new Error("CONFLICT");
    }),
  });
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: unexpected,
    req: new Request("http://fixture.invalid/api/trpc/failure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: null }),
    }),
    createContext: () => context,
  });
  assert.equal(response.status, 500);
  assert.equal(
    (await response.json()).error.json.data.code,
    "INTERNAL_SERVER_ERROR",
  );
  console.log(
    "RPC contracts: typed errors, CAS, permissions and raw text boundaries passed",
  );
}
