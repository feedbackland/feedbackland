import { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("user_org")
    .renameColumn("org_id", "orgId")
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema
    .alterTable("user_org")
    .renameColumn("orgId", "org_id")
    .execute();
}
