import "server-only";
import { sql, type Kysely } from "kysely";
import type { DB } from "./schema";
export const locks = {
  boot: 4702111234474983745n,
  sweep: 4702111234474983746n,
  setup: 4702111234474983747n,
  membership: 4702111234474983748n,
  images: 4702111234474983749n,
  search: 4702111234474983750n,
  insights: 4702111234474983751n,
} as const;
// Transaction scoped. Mutation order: membership -> images -> settings ->
// content. AI persistence follows AI -> content in a separate transaction.
export async function lock(trx: Kysely<DB>, key: bigint) {
  await sql`select pg_advisory_xact_lock(${key.toString()}::bigint)`.execute(
    trx,
  );
}
