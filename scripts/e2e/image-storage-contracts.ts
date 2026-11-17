import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { eventually } from "./run";
import { getPool, db } from "../../db/db";
import { locks } from "../../db/locks";
import { uploadDeadline } from "../../lib/images/upload-deadline";
import { BodyError } from "../../lib/http/limited-body";
import { enforceImageLimit } from "../../lib/rate-limit";
import { inspectImage } from "../../lib/images/container-limits";
import {
  managePendingImages,
  storeImage,
  sweepImages,
} from "../../lib/images/store";
import { createFeedbackPostQuery } from "../../queries/create-feedback-post";
import { updateFeedbackPostQuery } from "../../queries/update-feedback-post";
import { deleteFeedbackPostQuery } from "../../queries/delete-feedback-post";
import { createCommentQuery } from "../../queries/create-comment";
import { deleteCommentQuery } from "../../queries/delete-comment";
import { updateSettingsQuery } from "../../queries/update-settings";
import { samples } from "./image-fixtures";
// Ordinary maintenance can hold either the quota lock or a rate-counter row.
// Both must honor the same request budget and settle before the slot is reused.
async function deadlineContracts() {
  const pool = getPool();
  const holder = await pool.connect();
  const ip = "deadline-fixture";
  const count = async () =>
    Number((await holder.query("select count(*) as n from images")).rows[0].n);
  try {
    await enforceImageLimit(ip, uploadDeadline(new AbortController().signal));
    const before = await count();
    await holder.query("begin");
    await holder.query("select pg_advisory_xact_lock($1::bigint)", [
      locks.images.toString(),
    ]);
    await holder.query("select key from rate_limit where key=$1 for update", [
      "images:instance",
    ]);
    const insert = (signal: AbortSignal, ms: number) =>
      storeImage(
        samples.png,
        inspectImage(samples.png),
        uploadDeadline(signal, ms),
      );
    const timedOut = (e: unknown) => e instanceof BodyError && e.status === 408;
    await assert.rejects(insert(new AbortController().signal, 300), timedOut);
    await assert.rejects(
      enforceImageLimit(ip, uploadDeadline(new AbortController().signal, 300)),
      timedOut,
    );
    const disconnect = new AbortController();
    const interrupted = assert.rejects(
      insert(disconnect.signal, 2000),
      (e: unknown) => e instanceof BodyError && e.status === 400,
    );
    try {
      await eventually(
        () =>
          holder.query(
            "select count(*) as n from pg_locks where locktype='advisory' and not granted and objid=($1::bigint & 4294967295)::oid",
            [locks.images.toString()],
          ),
        (v) => Number(v.rows[0].n) > 0,
        5000,
      );
    } finally {
      disconnect.abort();
      await holder.query("rollback");
      await interrupted;
    }
    await holder.query("rollback");
    assert.equal(await count(), before);
    assert(
      (
        await enforceImageLimit(
          ip,
          uploadDeadline(new AbortController().signal),
        )
      ).allowed,
    );
    await insert(new AbortController().signal, 5000);
    assert.equal(await count(), before + 1);
  } finally {
    await holder.query("rollback");
    holder.release();
  }
}

async function contracts() {
  runtimeState().authSecret = (await migrateAndSeed()).authSecret;
  const actor = await db
    .selectFrom("auth_session")
    .innerJoin("user", "user.id", "auth_session.userId")
    .where("user.role", "=", "admin")
    .where("auth_session.scope", "=", "first-party")
    .select(["auth_session.id as sessionId", "user.id as userId"])
    .executeTakeFirstOrThrow();
  const upload = () => storeImage(samples.png, inspectImage(samples.png));
  const img = (id: string) => '<img src="/api/images/' + id + '">';
  const post = (id: string) =>
    createFeedbackPostQuery({
      description: img(id),
      authorId: actor.userId,
      sessionId: actor.sessionId,
    });
  const exists = async (id: string) =>
    !!(await db
      .selectFrom("images")
      .where("id", "=", id)
      .select("id")
      .executeTakeFirst());
  const revision = async () =>
    (
      await db
        .selectFrom("settings")
        .select("revision")
        .executeTakeFirstOrThrow()
    ).revision;
  const initial = await db
    .selectFrom("settings")
    .select("logoImageId")
    .executeTakeFirstOrThrow();
  const setLogo = async (id: string | null) =>
    updateSettingsQuery({
      ...actor,
      expectedRevision: await revision(),
      logoImageId: id,
    });
  const age = async (id: string) =>
    db
      .updateTable("images")
      .where("id", "=", id)
      .set({ createdAt: sql`now()-interval '25 hours'` })
      .execute();
  if (process.argv[2] === "detach") {
    const { id } = await db
      .selectFrom("feedback")
      .innerJoin("image_ref", "image_ref.postId", "feedback.id")
      .where("feedback.title", "=", "Untitled feedback")
      .select("feedback.id")
      .executeTakeFirstOrThrow();
    const ref = await db
      .selectFrom("image_ref")
      .where("postId", "=", id)
      .select("imageId")
      .executeTakeFirstOrThrow();
    const changed = await updateFeedbackPostQuery({
      ...actor,
      postId: id,
      expectedRevision: "1",
      description: "Detached",
      title: "Detached",
    });
    assert.equal(changed.revision, "2");
    assert(!(await exists(ref.imageId)));
    return;
  }
  await deadlineContracts();
  const preflight = await upload(),
    holder = await getPool().connect();
  try {
    await holder.query("begin");
    await holder.query("select pg_advisory_xact_lock($1::bigint)", [
      locks.images.toString(),
    ]);
    const saving = post(preflight.id);
    void saving.catch(() => {});
    try {
      await eventually(
        () =>
          holder.query(
            "select count(*) as n from pg_locks where locktype='advisory' and not granted and objid=($1::bigint & 4294967295)::oid",
            [locks.images.toString()],
          ),
        (v) => Number(v.rows[0].n) > 0,
      );
      await holder.query("delete from images where id=$1", [preflight.id]);
      await holder.query("commit");
      await assert.rejects(saving, /re-attach/i);
    } finally {
      await holder.query("rollback");
      await Promise.allSettled([saving]);
    }
  } finally {
    holder.release();
  }
  const shared = await upload(),
    p = await post(shared.id),
    nested = await upload();
  const c = await createCommentQuery({
    authorId: actor.userId,
    sessionId: actor.sessionId,
    postId: p.id,
    parentCommentId: null,
    content: img(shared.id),
  });
  await createCommentQuery({
    authorId: actor.userId,
    sessionId: actor.sessionId,
    postId: p.id,
    parentCommentId: c.id,
    content: img(nested.id),
  });
  await deleteCommentQuery({ ...actor, commentId: c.id });
  assert(!(await exists(nested.id)));
  assert(await exists(shared.id));
  // Reclaim can legally delete a detached prior logo before the test restores it.
  // Keep the browser fixture's logo attached while these swaps exercise cleanup.
  const priorLogoPost = initial.logoImageId
    ? await post(initial.logoImageId)
    : null;
  await setLogo(shared.id);
  await managePendingImages(actor, true);
  await deleteFeedbackPostQuery({ ...actor, postId: p.id });
  assert(await exists(shared.id));
  await setLogo(initial.logoImageId);
  await age(shared.id);
  await sweepImages();
  assert(!(await exists(shared.id)));
  await assert.rejects(post(randomUUID()), /re-attach/i);
  const invalid = await upload(),
    p2 = await post(invalid.id);
  await assert.rejects(
    updateFeedbackPostQuery({
      ...actor,
      postId: p2.id,
      title: "stale",
      description: "removed",
      expectedRevision: "9999",
    }),
    { code: "CONFLICT", message: "CONTENT_CHANGED" },
  );
  assert.equal(
    (
      await db
        .selectFrom("image_ref")
        .where("postId", "=", p2.id)
        .selectAll()
        .execute()
    ).length,
    1,
  );
  await deleteFeedbackPostQuery({ ...actor, postId: p2.id });
  assert(!(await exists(invalid.id)));
  await assert.rejects(
    managePendingImages(
      { userId: actor.userId, sessionId: randomUUID() },
      true,
    ),
    /administrator/i,
  );
  for (const cleanup of [
    () => managePendingImages(actor, true),
    () => sweepImages(),
  ]) {
    const candidate = await upload();
    await age(candidate.id);
    const [attached, cleaned] = await Promise.allSettled([
      post(candidate.id),
      cleanup(),
    ]);
    assert.equal(cleaned.status, "fulfilled");
    if (attached.status === "fulfilled") {
      assert(await exists(candidate.id));
      await deleteFeedbackPostQuery({ ...actor, postId: attached.value.id });
    } else {
      assert.match(String(attached.reason), /re-attach/i);
      assert(!(await exists(candidate.id)));
    }
    const logo = await upload();
    await age(logo.id);
    const [setting, removed] = await Promise.allSettled([
      setLogo(logo.id),
      cleanup(),
    ]);
    assert.equal(removed.status, "fulfilled");
    if (setting.status === "fulfilled") {
      assert(await exists(logo.id));
      await setLogo(initial.logoImageId);
    } else {
      assert.match(String(setting.reason), /re-attach/i);
      assert(!(await exists(logo.id)));
    }
  }
  if (priorLogoPost && initial.logoImageId) {
    assert.equal(
      (
        await db
          .selectFrom("settings")
          .select("logoImageId")
          .executeTakeFirstOrThrow()
      ).logoImageId,
      initial.logoImageId,
    );
    await deleteFeedbackPostQuery({ ...actor, postId: priorLogoPost.id });
    assert(await exists(initial.logoImageId));
  }
  const parentImage = await upload(),
    root = await post(parentImage.id),
    childImage = await upload();
  await createCommentQuery({
    postId: root.id,
    parentCommentId: null,
    content: img(childImage.id),
    authorId: actor.userId,
    sessionId: actor.sessionId,
  });
  await deleteFeedbackPostQuery({ ...actor, postId: root.id });
  assert(!(await exists(parentImage.id)));
  assert(!(await exists(childImage.id)));
  await managePendingImages(actor, true);
}
async function main() {
  if (process.argv[2] === "sweep") await sweepImages();
  else await contracts();
  console.log(JSON.stringify({ completed: true }));
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
