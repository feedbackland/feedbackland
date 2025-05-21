import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('admin_invites')
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('orgId', 'text', (col) => col.notNull()) // Consider adding .references('org.id').onDelete('cascade') if foreign key is desired
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint('admin_invites_pkey', ['email', 'orgId'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('admin_invites').execute();
}
