import "server-only";
import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  // Earlier email and administrator grants are indistinguishable. Expire just
  // those grants at upgrade. Cascading an issuer deletion revokes its grants.
  await sql`
    alter table auth_verification add column "resetIssuerId" text
      references "user"(id) on delete cascade;
    delete from auth_verification where identifier like 'reset-password:%';
    create index auth_verification_reset_user_idx on auth_verification(value)
      where identifier like 'reset-password:%';
    create index auth_verification_reset_issuer_idx on auth_verification("resetIssuerId")
      where "resetIssuerId" is not null;
    alter table recovery_claim add column "credentialFingerprint" text;
  `.execute(db);
}
