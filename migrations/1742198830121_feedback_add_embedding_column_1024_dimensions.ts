import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("feedback")
    .addColumn("embedding", sql`vector(768)`)
    .execute();

  await db.schema
    .createIndex("feedback_embedding_index")
    .on("feedback")
    .using("hnsw")
    .expression(sql`embedding vector_cosine_ops`)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex("feedback_embedding_index")
    .on("feedback")
    .execute();

  await db.schema.alterTable("feedback").dropColumn("embedding").execute();
}
