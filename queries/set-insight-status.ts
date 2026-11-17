import "server-only";
import { DomainError } from "@/lib/domain-error";
import type { Actor } from "@/lib/auth/authorization";
import type { FeedbackStatus } from "@/lib/typings";
import { changeFeedbackStatuses } from "./update-feedback-post-status";

export async function setInsightStatusQuery(
  input: Actor & {
    insightId: string;
    version: string;
    status: FeedbackStatus;
    signal?: AbortSignal;
  },
) {
  const rows = await changeFeedbackStatuses(input, async (trx) => {
    const theme = await trx
      .selectFrom("insights")
      .select("id")
      .where("id", "=", input.insightId)
      .where("version", "=", input.version)
      .where("isArchived", "=", false)
      .forShare()
      .executeTakeFirst();
    if (!theme) throw new DomainError("CONFLICT", "INSIGHT_CHANGED");
    const members = await trx
      .selectFrom("insight_member")
      .innerJoin("feedback as f", "f.id", "insight_member.postId")
      .select(["postId", "f.status"])
      .where("insightId", "=", theme.id)
      .execute();
    if (
      members.length &&
      members.every((m) => m.status === "done" || m.status === "declined") &&
      members.some((m) => m.status !== input.status)
    )
      throw new DomainError("CONFLICT", "INSIGHT_CHANGED");
    return members.map((m) => m.postId);
  });
  return {
    insightId: input.insightId,
    status: input.status,
    postsUpdated: rows.filter((r) => r.changed).length,
  };
}
