import "server-only";
import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await sql`
    alter table ai_settings
      add column "configGeneration" bigint not null default 0 check ("configGeneration" >= 0),
      add column "checkSequence" bigint not null default 0 check ("checkSequence" >= 0),
      add column "catalogueModel" text,
      add column "catalogueVision" boolean;
    update ai_settings set "effectiveConfigToken"=null, "lastCheck"=null,
      "creditWaitUntil"=null, "creditWaitConfigToken"=null;
  `.execute(db);
}
