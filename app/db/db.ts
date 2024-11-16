import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { DB } from "@/app/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const dialect = new PostgresDialect({
  pool,
});

const db = new Kysely<DB>({
  dialect,
});

export { pool, dialect, db };
