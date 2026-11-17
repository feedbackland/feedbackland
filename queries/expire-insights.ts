import "server-only";
import { sql, type Kysely } from "kysely";
import type { DB } from "@/db/schema";

export function expireInsights(connection: Kysely<DB>) {
  return sql`update insight_reports set status='failed',stage='complete',error='stale-run',"finishedAt"=clock_timestamp(),"inputSnapshot"=null,"requestPlan"=null
    where status='running' and "heartbeatAt"<=clock_timestamp()-interval '5 minutes'`.execute(
    connection,
  );
}
