import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { getConfig, neutraliseAuthEnv } from "../lib/config";
import { buildAuthOptions } from "../lib/auth/options";
import { AUTH_DDL } from "../db/migrations/0001_init";
import assert from "node:assert/strict";
async function main() {
  neutraliseAuthEnv();
  const pool = new Pool({ ...getConfig().database(), max: 1 });
  try {
    const result = await pool.query(
      "select count(*)::int as count from information_schema.tables where table_schema = current_schema() and table_type = 'BASE TABLE'",
    );
    if (result.rows[0].count !== 0)
      throw new Error("db:auth-ddl requires a separate empty database");
    const migration = await getMigrations(buildAuthOptions({ db: pool }));
    const generated = await migration.compileMigrations();
    if (process.argv.includes("--verify")) {
      assert.equal(generated, AUTH_DDL);
      console.log("Auth DDL matches the exact pinned options");
    } else process.stdout.write(generated);
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    "Auth DDL generation failed; use a separate empty database and valid database configuration.",
  );
  process.exitCode = 1;
});
