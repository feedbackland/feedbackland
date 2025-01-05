import { Kysely, Migration } from "kysely";

export default class AddIndexToOrgSubdomain implements Migration {
  async up(db: Kysely<any>): Promise<void> {
    await db.schema
      .createIndex("org_subdomain_idx")
      .on("org")
      .column("subdomain")
      .execute();
  }

  async down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("org").dropIndex("org_subdomain_idx").execute();
  }
}
