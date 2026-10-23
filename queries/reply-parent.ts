import "server-only";
import { DomainError } from "@/lib/domain-error";
import { sql, type Kysely } from "kysely";
import type { DB } from "../db/schema";
export async function validateReplyParent(
  trx: Kysely<DB>,
  postId: string,
  parentId: string | null,
) {
  if (!parentId) return;
  const { rows } = await sql<{
    id: string;
    parent: string | null;
    depth: number;
    cycle: boolean;
  }>`
    with recursive chain as (
      select id,"parentCommentId" as parent,1 as depth,array[id] as path,false as cycle from comment where id=${parentId}::uuid and "postId"=${postId}::uuid
      union all
      select c.id,c."parentCommentId",p.depth+1,p.path||c.id,c.id=any(p.path) from comment c join chain p on c.id=p.parent where c."postId"=${postId}::uuid and p.depth<9 and not p.cycle
    ) select id,parent,depth,cycle from chain order by depth`.execute(trx);
  if (
    !rows.length ||
    rows.length > 8 ||
    rows.some((row) => row.cycle) ||
    rows.at(-1)?.parent !== null
  )
    throw new DomainError("BAD_REQUEST", "INVALID_REPLY_PARENT");
}
