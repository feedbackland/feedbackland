import assert from "node:assert/strict";
import { sql } from "kysely";
import { db } from "../../db/db";
import { createFeedbackPostQuery } from "../../queries/create-feedback-post";
import { updateFeedbackPostQuery } from "../../queries/update-feedback-post";
import { updateCommentQuery } from "../../queries/update-comment";
import { createCommentQuery } from "../../queries/create-comment";
import { updateSettingsQuery } from "../../queries/update-settings";
import type { Actor } from "../../lib/auth/authorization";
import { vectorMetadata } from "../../db/vector";
export async function revisions(actor: Actor) {
  const post = await createFeedbackPostQuery({
    description: "First sentence. Second sentence!",
    authorId: actor.userId,
  });
  assert.equal(post.title, "First sentence.");
  assert.equal(post.revision, "1");
  assert.equal(post.moderationState, "disabled");
  assert.equal(post.embedding, null);
  const race = await Promise.allSettled(
    ["A", "B"].map((title) =>
      updateFeedbackPostQuery({
        ...actor,
        postId: post.id,
        title,
        description: "Revised text",
        expectedRevision: "1",
      }),
    ),
  );
  assert.equal(
    race.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    (
      race.find(
        (result) => result.status === "rejected",
      ) as PromiseRejectedResult
    ).reason.message,
    "CONFLICT",
  );
  const vector = JSON.stringify(
    Array.from({ length: vectorMetadata().dimensions }, (_, i) =>
      i === 0 ? 1 : 0,
    ),
  );
  const delayed = await db
    .updateTable("feedback")
    .set({ embedding: vector })
    .where("id", "=", post.id)
    .where("revision", "=", "1")
    .executeTakeFirst();
  assert.equal(delayed.numUpdatedRows, 0n);
  await db
    .updateTable("feedback")
    .set({ revision: "9007199254740993" })
    .where("id", "=", post.id)
    .execute();
  const large = await updateFeedbackPostQuery({
    ...actor,
    postId: post.id,
    title: "Large",
    description: "Exact integer",
    expectedRevision: "9007199254740993",
  });
  assert.equal(large.revision, "9007199254740994");
  await db
    .updateTable("feedback")
    .set({ revision: "9223372036854775807" })
    .where("id", "=", post.id)
    .execute();
  await assert.rejects(
    updateFeedbackPostQuery({
      ...actor,
      postId: post.id,
      title: "Overflow",
      description: "Must not wrap",
      expectedRevision: "9223372036854775807",
    }),
    (error: unknown) => (error as { code: string }).code === "22003",
  );
  assert.equal(
    (
      await db
        .selectFrom("feedback")
        .select("revision")
        .where("id", "=", post.id)
        .executeTakeFirstOrThrow()
    ).revision,
    "9223372036854775807",
  );
  const comment = await createCommentQuery({
    authorId: actor.userId,
    postId: post.id,
    parentCommentId: null,
    content: "Before",
  });
  const comments = await Promise.allSettled(
    ["After A", "After B"].map((content) =>
      updateCommentQuery({
        ...actor,
        commentId: comment.id,
        content,
        expectedRevision: "1",
      }),
    ),
  );
  assert.equal(
    comments.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const settings = await db
    .selectFrom("settings")
    .select("revision")
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  const saves = await Promise.allSettled(
    ["Title A", "Title B"].map((platformTitle) =>
      updateSettingsQuery({
        ...actor,
        expectedRevision: settings.revision,
        platformTitle,
      }),
    ),
  );
  assert.equal(
    saves.filter((result) => result.status === "fulfilled").length,
    1,
  );
  await assert.rejects(
    updateSettingsQuery({
      ...actor,
      expectedRevision: settings.revision,
      platformTitle: "Delayed",
    }),
    /CONFLICT/,
  );
  const fences = await sql<{
    value: string;
  }>`select 4702111234474983745::bigint as value`.execute(db);
  assert.equal(fences.rows[0].value, "4702111234474983745");
}
