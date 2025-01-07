import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Step 1: Create the ENUM type
  await sql`
    CREATE TYPE user_org_role AS ENUM ('admin', 'user');
  `.execute(db);

  // Step 2: Alter the column to use the ENUM type and set default value to 'user'
  await sql`
    ALTER TABLE user_org
    ALTER COLUMN role TYPE user_org_role
    USING role::user_org_role,
    ALTER COLUMN role SET DEFAULT 'user';
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Step 1: Revert the column back to VARCHAR
  await sql`
    ALTER TABLE user_org
    ALTER COLUMN role TYPE VARCHAR
    USING role::TEXT;
  `.execute(db);

  // Step 2: Drop the ENUM type
  await sql`
    DROP TYPE user_org_role;
  `.execute(db);
}
