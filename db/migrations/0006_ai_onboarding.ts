import "server-only";
import { sql, type Kysely } from "kysely";
export async function up(db: Kysely<unknown>) {
  await sql`alter table ai_settings add column "keyUndo" jsonb`.execute(db);
}
