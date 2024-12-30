import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("org")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    ) // Automatically generates a UUID
    .addColumn("name", "text", (col) => col.notNull()) // Name column, required
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("org").execute();
}
