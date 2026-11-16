import "server-only";
import type { Kysely, Transaction } from "kysely";
import { contentTransaction } from "../db/content-transaction";
import type { DB } from "../db/schema";
import { lock, locks } from "../db/locks";
import { authorizeContentWrite, type Actor } from "../lib/auth/authorization";
import { DomainError } from "../lib/domain-error";
import { validateImages, replaceImageRefs } from "../lib/images/store";
import {
  checkContentRequest,
  recordCoverage,
  screenContent,
} from "../lib/llm/content";
import { lockContentConfiguration } from "../lib/llm/settings-store";
import { revision } from "../lib/revision";
import { scheduleEmbedding, postEmbeddingText } from "../lib/llm/embeddings";
import { validateReplyParent } from "./reply-parent";

type Target =
  | { kind: "new-post" }
  | { kind: "reply"; postId: string; parentCommentId: string | null }
  | {
      kind: "edit";
      table: "feedback" | "comment";
      id: string;
      expectedRevision: string;
    };
type Write = {
  actor: Actor | null;
  target: Target;
  text: string;
  imageIds: string[];
  signal?: AbortSignal;
};
async function verify(
  connection: Kysely<DB>,
  { actor, target }: Write,
  final: boolean,
) {
  const admin =
    actor && (await authorizeContentWrite(connection, actor, final));
  if (target.kind === "new-post") return false;
  if (target.kind === "reply") {
    let post = connection
      .selectFrom("feedback")
      .select("id")
      .where("id", "=", target.postId);
    if (final) post = post.forKeyShare();
    if (!(await post.executeTakeFirst()))
      throw new DomainError("NOT_FOUND", "POST_NOT_FOUND");
    await validateReplyParent(
      connection,
      target.postId,
      target.parentCommentId,
    );
    return false;
  }
  const expected = revision(target.expectedRevision);
  let owner = connection
    .selectFrom(target.table)
    .select(["authorId", "revision"])
    .where("id", "=", target.id);
  if (final) owner = owner.forUpdate();
  const row = await owner.executeTakeFirst();
  if (!row) throw new DomainError("NOT_FOUND", "CONTENT_NOT_FOUND");
  if (!actor || (!admin && row.authorId !== actor.userId))
    throw new DomainError("FORBIDDEN", "UNAUTHORIZED");
  if (row.revision !== expected)
    throw new DomainError("CONFLICT", "CONTENT_CHANGED");
  return row.authorId !== actor.userId;
}
export async function prepareContent(input: Write) {
  checkContentRequest(input.signal);
  const images =
    !input.actor && input.target.kind === "new-post" && !input.imageIds.length
      ? []
      : await contentTransaction(input.signal, async (trx) => {
          await verify(trx, input, false);
          return validateImages(trx, input.imageIds);
        });
  const moderation = await screenContent(
    input.text,
    images,
    input.actor !== null,
    input.signal,
    input.target.kind === "new-post",
  );
  return { ...input, ...moderation };
}
export async function commitContent<
  T extends {
    id: string;
    revision: string;
    plainText?: string;
    title?: string;
  },
>(
  input: Awaited<ReturnType<typeof prepareContent>>,
  ownerKind: "post" | "comment",
  write: (trx: Transaction<DB>) => Promise<T>,
) {
  const committed = await contentTransaction(input.signal, async (trx) => {
    if (input.actor) await lock(trx, locks.membership);
    await lock(trx, locks.images);
    await lockContentConfiguration(trx, input.config);
    const requiresAdmin = await verify(trx, input, true);
    checkContentRequest(input.signal);
    const row = await write(trx);
    const owner =
      ownerKind === "post" ? { postId: row.id } : { commentId: row.id };
    await replaceImageRefs(trx, owner, input.imageIds);
    await recordCoverage(trx, owner, row.revision, input.coverage);
    // The membership and session rows remain locked. Time can still advance
    // during owner, reference or event writes. Roll them all back on expiry.
    if (input.actor) {
      const admin = await authorizeContentWrite(trx, input.actor);
      if (requiresAdmin && !admin)
        throw new DomainError("FORBIDDEN", "UNAUTHORIZED");
    }
    checkContentRequest(input.signal);
    return row;
  });
  if (typeof committed.plainText === "string")
    scheduleEmbedding({
      kind: ownerKind,
      id: committed.id,
      revision: committed.revision,
      text:
        ownerKind === "post"
          ? postEmbeddingText(committed.title ?? "", committed.plainText)
          : committed.plainText,
    });
  return committed;
}
