import { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("org")
    .renameColumn("is_claimed", "isClaimed")
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema
    .alterTable("org")
    .renameColumn("isClaimed", "is_claimed")
    .execute();
}
