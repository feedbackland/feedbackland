import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("comment")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("authorId", "text", (col) => col.notNull().references("user.id"))
    .addColumn("postId", "uuid", (col) =>
      col.notNull().references("feedback.id").onDelete("cascade"),
    )
    .addColumn("parentCommentId", "uuid", (col) =>
      col.references("comment.id").onDelete("cascade"),
    )
    .addColumn("createdAt", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updatedAt", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("comment_author_id_index")
    .on("comment")
    .column("authorId")
    .execute();

  await db.schema
    .createIndex("comment_post_id_index")
    .on("comment")
    .column("postId")
    .execute();

  await db.schema
    .createIndex("comment_parent_comment_id_index")
    .on("comment")
    .column("parentCommentId")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("comment_user_id_index").execute();
  await db.schema.dropIndex("comment_post_id_index").execute();
  await db.schema.dropIndex("comment_parent_comment_id_index").execute();
  await db.schema.dropTable("comment").execute();
}
