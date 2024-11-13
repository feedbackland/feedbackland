import { getXataClient, DatabaseSchema } from "@/app/db/xata";
import { Kysely } from "kysely";
import { XataDialect, Model } from "@xata.io/kysely";

const xata = getXataClient();

const db = new Kysely<Model<DatabaseSchema>>({
  dialect: new XataDialect({ xata }),
});

export default async function Home() {
  const record = await db
    .selectFrom("posts")
    .selectAll()
    .where("xata_id", "=", "rec_csqc9bsgfdtt6fchk070")
    .executeTakeFirst();

  console.log(record);

  return <div className="">{record?.text}</div>;
}
