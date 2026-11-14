import "server-only";
import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/schema";
import { db } from "../../db/db";
import { lock, locks } from "../../db/locks";
import { getConfig } from "../config";
import { DomainError } from "../domain-error";
import { BodyError } from "../http/limited-body";
import { requireAdmin, type Actor } from "../auth/authorization";
import { uploadTransaction, type UploadDeadline } from "./upload-deadline";
import type { inspectImage } from "./container-limits";
type Trx = Transaction<DB>;
type Owner = { postId: string } | { commentId: string };
const unattached = sql<boolean>`not exists(select 1 from image_ref r where r."imageId"=images.id)
  and not exists(select 1 from settings s where s."logoImageId"=images.id)`;
export async function imageUsage(connection: Kysely<DB>) {
  return connection
    .selectFrom("images")
    .select([
      sql<string>`coalesce(sum("byteSize"),0)::text`.as("totalBytes"),
      sql<string>`coalesce(sum("byteSize") filter (where ${unattached}),0)::text`.as(
        "pendingBytes",
      ),
      sql<string>`count(*) filter (where ${unattached})::text`.as(
        "pendingCount",
      ),
    ])
    .executeTakeFirstOrThrow();
}
export async function storeImage(
  bytes: Buffer,
  metadata: ReturnType<typeof inspectImage>,
  deadline?: UploadDeadline,
) {
  const config = getConfig();
  const insert = async (
    trx: Trx,
    run = <T>(query: () => Promise<T>) => query(),
  ) => {
    await run(() => lock(trx, locks.images));
    const usage = await run(() => imageUsage(trx)),
      size = BigInt(bytes.length);
    if (
      (config.maxImageStorageBytes !== undefined &&
        BigInt(usage.totalBytes) + size > config.maxImageStorageBytes) ||
      BigInt(usage.pendingBytes) + size > config.maxPendingImageBytes
    )
      throw new BodyError(507, "IMAGE_STORAGE_FULL");
    return run(() =>
      trx
        .insertInto("images")
        .values({ ...metadata, bytes, byteSize: bytes.length })
        .returning(["id", "width", "height"])
        .executeTakeFirstOrThrow(),
    );
  };
  return deadline
    ? uploadTransaction(deadline, insert)
    : db.transaction().execute(insert);
}
export async function validateImages(
  connection: Kysely<DB>,
  ids: readonly string[],
) {
  if (!ids.length) return [];
  const found = await connection
    .selectFrom("images")
    .select(["id", "byteSize", "width", "height", "contentType"])
    .where("id", "in", ids)
    .execute();
  if (found.length !== ids.length)
    throw new DomainError(
      "BAD_REQUEST",
      "An attachment is unavailable. Re-attach it before saving.",
    );
  const byId = new Map(found.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)!);
}
// Caller holds membership (when applicable), then the image lock, before owner rows.
export async function replaceImageRefs(trx: Trx, owner: Owner, ids: string[]) {
  await validateImages(trx, ids);
  const column = "postId" in owner ? "postId" : "commentId",
    value = "postId" in owner ? owner.postId : owner.commentId;
  const removed = await trx
    .deleteFrom("image_ref")
    .where(column, "=", value)
    .returning("imageId")
    .execute();
  if (ids.length)
    await trx
      .insertInto("image_ref")
      .values(ids.map((imageId) => ({ ...owner, imageId })))
      .execute();
  await trimDetached(
    trx,
    removed.map((row) => row.imageId).filter((id) => !ids.includes(id)),
  );
}
export async function trimDetached(trx: Trx, ids: string[]) {
  if (!ids.length) return;
  if (
    BigInt((await imageUsage(trx)).pendingBytes) >
    getConfig().maxPendingImageBytes
  )
    await deleteOrphans(trx, ids);
}
export async function deleteOrphans(trx: Trx, ids: string[]) {
  if (ids.length)
    await trx
      .deleteFrom("images")
      .where(sql<boolean>`images.id = any(${ids}::uuid[])`)
      .where(unattached)
      .execute();
}
// Gather before the foreign-key cascades remove the owner and its reference rows.
export async function deletionImages(trx: Trx, owner: Owner) {
  const descendants =
    "postId" in owner
      ? trx
          .selectFrom("comment")
          .select("id")
          .where("postId", "=", owner.postId)
      : trx
          .withRecursive("subtree", (qb) =>
            qb
              .selectFrom("comment")
              .select("id")
              .where("id", "=", owner.commentId)
              .unionAll(
                qb
                  .selectFrom("comment")
                  .innerJoin("subtree", "subtree.id", "comment.parentCommentId")
                  .select("comment.id"),
              ),
          )
          .selectFrom("subtree")
          .select("id");
  let refs = trx.selectFrom("image_ref").select("imageId").distinct();
  refs = refs.where((eb) =>
    "postId" in owner
      ? eb.or([
          eb("postId", "=", owner.postId),
          eb("commentId", "in", descendants),
        ])
      : eb("commentId", "in", descendants),
  );
  return (await refs.execute()).map((row) => row.imageId);
}
export async function managePendingImages(actor: Actor, reclaim: boolean) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, actor);
    await lock(trx, locks.images);
    if (reclaim) await trx.deleteFrom("images").where(unattached).execute();
    return imageUsage(trx);
  });
}
export async function sweepImages() {
  let deleted: number;
  do {
    deleted = await db.transaction().execute(async (trx) => {
      await sql`set local statement_timeout='5s'`.execute(trx);
      const { rows } = await sql<{
        ok: boolean;
      }>`select pg_try_advisory_xact_lock(${locks.sweep.toString()}::bigint) as ok`.execute(
        trx,
      );
      if (!rows[0].ok) return 0;
      await lock(trx, locks.images);
      const ids = trx
        .selectFrom("images")
        .select("id")
        .where(unattached)
        .where(
          "createdAt",
          "<",
          sql<Date>`clock_timestamp()-interval '24 hours'`,
        )
        .orderBy("id")
        .limit(1000)
        .forUpdate()
        .skipLocked();
      return Number(
        (
          await trx
            .deleteFrom("images")
            .where("id", "in", ids)
            .executeTakeFirst()
        ).numDeletedRows,
      );
    });
  } while (deleted === 1000);
}
