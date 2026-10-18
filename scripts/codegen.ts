import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { generate, PostgresDialect as GeneratorDialect } from "kysely-codegen";
import { getConfig } from "../lib/config";
async function main() {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({ ...getConfig().database(), max: 1 }),
    }),
  });
  try {
    await generate({
      db,
      dialect: new GeneratorDialect(),
      defaultSchemas: ["public"],
      excludePattern: "public.kysely_migration*",
      typeOnlyImports: true,
      outFile: "db/schema.ts",
      verify: process.argv.includes("--verify"),
    });
  } finally {
    await db.destroy();
  }
}
void main().catch(() => {
  console.error(
    "Schema generation failed; use the migrated disposable database.",
  );
  process.exitCode = 1;
});
