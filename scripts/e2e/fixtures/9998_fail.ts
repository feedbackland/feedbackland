import { sql, type Kysely } from "kysely";
export async function up(db: Kysely<unknown>) {
  await sql`select * from deliberately_missing_migration_fixture`.execute(db);
}
