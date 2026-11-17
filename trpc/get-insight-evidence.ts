import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { contentTransaction } from "@/db/content-transaction";
import { requireAdmin, type Actor } from "@/lib/auth/authorization";
import { DomainError } from "@/lib/domain-error";

const pageInput = z.object({
  insightId: z.uuid(),
  version: z.uuid(),
  cursor: z.number().int().min(0).max(2147483647).default(0),
});
export async function getInsightEvidencePage(
  actor: Actor,
  input: z.output<typeof pageInput>,
  signal?: AbortSignal,
) {
  return contentTransaction(
    signal,
    async (trx) => {
      await requireAdmin(trx, actor);
      const theme = await trx
        .selectFrom("insights")
        .select("id")
        .where("id", "=", input.insightId)
        .where("version", "=", input.version)
        .where("isArchived", "=", false)
        .executeTakeFirst();
      if (!theme) throw new DomainError("CONFLICT", "INSIGHT_CHANGED");
      const rows = await trx
        .selectFrom("insight_member as m")
        .innerJoin("feedback as f", "f.id", "m.postId")
        .where("m.insightId", "=", input.insightId)
        .where("m.ordinal", ">", input.cursor)
        .orderBy("m.ordinal")
        .limit(51)
        .select([
          "m.ordinal",
          "f.id",
          "f.title",
          "f.status",
          "f.createdAt",
          "f.category",
          "f.upvotes",
          (eb) =>
            eb
              .selectFrom("comment")
              .select(eb.fn.countAll().as("count"))
              .whereRef("postId", "=", "f.id")
              .as("commentCount"),
        ])
        .execute();
      const posts = rows.slice(0, 50);
      return {
        posts,
        nextCursor: rows.length > 50 ? posts[posts.length - 1].ordinal : null,
      };
    },
    "repeatable read",
  );
}
export const getInsightEvidence = adminProcedure
  .input(pageInput)
  .query(({ ctx, input }) =>
    getInsightEvidencePage(
      { userId: ctx.userId, sessionId: ctx.sessionId },
      input,
      ctx.signal,
    ),
  );
