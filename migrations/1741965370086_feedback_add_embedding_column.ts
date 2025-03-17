import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("feedback")
    .addColumn("embedding", sql`vector(3072)`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("feedback").dropColumn("embedding").execute();
}
