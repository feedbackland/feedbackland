import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("org")
    .addColumn("is_claimed", "boolean", (cb) => cb.defaultTo(false).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("org").dropColumn("is_claimed").execute();
}
