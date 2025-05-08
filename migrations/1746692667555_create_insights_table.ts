import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("insights")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql.raw("gen_random_uuid()")),
    )
    .addColumn("orgId", "uuid", (col) =>
      col.references("org.id").onDelete("cascade").notNull(),
    )
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("upvotes", "integer", (col) => col.notNull())
    .addColumn("commentCount", "integer", (col) => col.notNull())
    .addColumn("status", "text")
    .addColumn("feedback_post_ids", sql.raw("TEXT[]"), (col) => col.notNull())
    .addColumn("priority", "integer", (col) => col.notNull())
    .addColumn("createdAt", "timestamp", (col) =>
      col.defaultTo(sql.raw("now()")).notNull(),
    )
    .addColumn("updatedAt", "timestamp", (col) =>
      col.defaultTo(sql.raw("now()")).notNull(),
    )
    .execute();

  // Add an index on orgId for faster lookups
  await db.schema
    .createIndex("insights_org_id_index")
    .on("insights")
    .column("orgId")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("insights").execute();
}
