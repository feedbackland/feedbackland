import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("org")
    .addColumn("subdomain", "varchar", (col) =>
      col
        .defaultTo(sql`'unknown'`)
        .notNull()
        .unique()
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("org").dropColumn("subdomain").execute();
}
