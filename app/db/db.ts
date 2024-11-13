import "server-only";

import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { DB } from "@/app/db/schema";

// import { getXataClient, DatabaseSchema } from "@/app/db/xata";
// import { Kysely } from "kysely";
// import { XataDialect, Model } from "@xata.io/kysely";

// const xata = getXataClient();

// const db = new Kysely<Model<DatabaseSchema>>({
//   dialect: new XataDialect({ xata }),
// });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export { db, pool };
