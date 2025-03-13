import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("user_upvote")
    .addPrimaryKeyConstraint("user_upvote_pkey", ["userId", "postId"])
    .execute();
}

// Migration to remove the composite primary key (rollback)
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("user_upvote")
    .dropConstraint("user_upvote_pkey")
    .execute();
}
