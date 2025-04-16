import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("comment")
    .addColumn("embedding", sql`vector(768)`)
    .execute();

  await db.schema
    .createIndex("comment_embedding_index")
    .on("comment")
    .using("hnsw")
    .expression(sql`embedding vector_cosine_ops`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("comment_embedding_index").on("comment").execute();
  await db.schema.alterTable("comment").dropColumn("embedding").execute();
}
