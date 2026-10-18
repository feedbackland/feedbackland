import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { DB } from "@/db/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 1_750,
});
// Idle connections can fail when Postgres restarts. Never log connection details.
pool.on("error", () => console.warn("database: idle connection unavailable"));

const dialect = new PostgresDialect({
  pool,
});

const db = new Kysely<DB>({
  dialect,
});

export { pool, dialect, db };
