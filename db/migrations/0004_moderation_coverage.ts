import "server-only";
import { sql, type Kysely } from "kysely";
export async function up(db: Kysely<unknown>) {
  await sql`create index feedback_pending_moderation_idx on feedback(id) where "moderationState" in ('unscreened','screened-text')`.execute(
    db,
  );
  await sql`create index comment_pending_moderation_idx on comment(id) where "moderationState" in ('unscreened','screened-text')`.execute(
    db,
  );
}
