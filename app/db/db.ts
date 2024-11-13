import "server-only";
import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { DB } from "@/app/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export { db, pool };
