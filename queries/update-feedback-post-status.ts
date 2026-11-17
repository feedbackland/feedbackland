import "server-only";
import { sql, type Transaction } from "kysely";
import { contentTransaction } from "@/db/content-transaction";
import type { DB } from "@/db/schema";
import { lock, locks } from "@/db/locks";
import { requireAdmin, type Actor } from "@/lib/auth/authorization";
import { DomainError } from "@/lib/domain-error";
import type { FeedbackStatus } from "@/lib/typings";

type StatusChange = Actor & { status: FeedbackStatus; signal?: AbortSignal };

export function changeFeedbackStatuses(
  input: StatusChange,
  members: (trx: Transaction<DB>) => Promise<string[]>,
) {
  return contentTransaction(input.signal, async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, input, true);
    const ids = await members(trx);
    const { rows } = await sql<{ id: string; changed: boolean }>`
      with locked as materialized (
        select id,status from feedback where id=any(${ids}::uuid[]) order by id for update
      ), changed as (
        update feedback f set status=${input.status}::feedback_status from locked p
        where f.id=p.id and p.status is distinct from ${input.status}::feedback_status returning f.id
      ), history as (
        insert into comment("postId","authorId",content,"plainText",revision,"moderationState")
        select id,${input.userId},
          case when ${input.status}::text is null then 'Updated status to none'
          else 'Updated status to <span data-type="status" data-id="'||id||'" data-label="'||
            replace(${input.status}::text,' ','-')||'">'||${input.status}::text||'</span>' end,
          ${"Updated status to " + (input.status ?? "none")},1,'disabled' from changed
      )
      select p.id,c.id is not null as changed from locked p left join changed c using(id)`.execute(
      trx,
    );
    await requireAdmin(trx, input);
    return rows;
  });
}

export async function updateFeedbackPostStatusQuery(
  input: StatusChange & { postId: string },
) {
  const rows = await changeFeedbackStatuses(input, async () => [input.postId]);
  if (!rows.length)
    throw new DomainError("NOT_FOUND", "Feedback post no longer exists");
  return { id: input.postId, status: input.status };
}
