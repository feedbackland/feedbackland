import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user_org")
    .addColumn("user_id", "text", (col) =>
      col.references("user.id").onDelete("cascade").notNull()
    )
    .addColumn("org_id", "uuid", (col) =>
      col.references("org.id").onDelete("cascade").notNull()
    )
    .addColumn("role", "varchar(50)", (col) =>
      col.check(sql`role IN ('admin', 'user')`).notNull()
    )
    .addPrimaryKeyConstraint("user_org_pk", ["user_id", "org_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("user_org").execute();
}
