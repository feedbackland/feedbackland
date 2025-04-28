import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("activity_seen")
    .addColumn("userId", "text", (col) =>
      col.notNull().references("user.id").onDelete("cascade"),
    )
    .addColumn("itemId", "uuid", (col) => col.notNull()) // Cannot add FK easily due to union source (feedback/comment)
    .addColumn("itemType", "text", (col) => col.notNull()) // 'post' or 'comment'
    .addColumn("seenAt", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    // Composite primary key to ensure uniqueness per user/item/type
    .addPrimaryKeyConstraint("activity_seen_pkey", [
      "userId",
      "itemId",
      "itemType",
    ])
    .execute();

  // Index for efficient lookups in the activity feed query
  await db.schema
    .createIndex("idx_activity_seen_user_item")
    .on("activity_seen")
    .columns(["userId", "itemType", "itemId"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_activity_seen_user_item").execute();
  await db.schema.dropTable("activity_seen").execute();
}
