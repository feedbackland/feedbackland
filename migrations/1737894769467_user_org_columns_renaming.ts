import { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("user_org")
    .renameColumn("user_id", "userId")
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema
    .alterTable("user_org")
    .renameColumn("userId", "user_id")
    .execute();
}
