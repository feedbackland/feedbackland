import assert from "node:assert/strict";
import { sql } from "kysely";
import { db } from "../../db/db";
import { migrations } from "../../db/migrations";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { getInsightsQuery } from "../../queries/get-insights";

async function main() {
  // Create the exact table shapes a populated P09 installation hands to P10.
  const previous = Object.fromEntries(
    Object.entries(migrations).filter(
      ([name]) => name < "0005_insight_members",
    ),
  );
  await migrateAndSeed(previous);
  const post = await db
    .insertInto("feedback")
    .values({
      title: "Existing",
      description: "Existing",
      plainText: "Existing",
      moderationState: "screened",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const missing = "00000000-0000-4000-8000-000000000002";
  const {
    rows: [theme],
  } = await sql<{
    id: string;
  }>`insert into insights(title,description,ids) values('Previous theme','Prior report',array[${post.id}::text,${post.id.toUpperCase()}::text,'retired value',null,${missing}::text]) returning id`.execute(
    db,
  );
  await migrateAndSeed();
  await migrateAndSeed();
  const members = () =>
    db
      .selectFrom("insight_member")
      .select(["ordinal", "postId"])
      .where("insightId", "=", theme.id)
      .orderBy("ordinal")
      .execute();
  assert.deepEqual(await members(), [
    { ordinal: 1, postId: post.id },
    { ordinal: 5, postId: missing },
  ]);
  const [old] = (await getInsightsQuery()).insights;
  assert.equal(old.postCount, 1);
  await db
    .updateTable("insights")
    .where("id", "=", theme.id)
    .set({ ids: [missing, post.id] })
    .execute();
  const [updated] = (await getInsightsQuery()).insights;
  assert.notEqual(updated.version, old.version);
  assert.deepEqual(await members(), [
    { ordinal: 1, postId: missing },
    { ordinal: 2, postId: post.id },
  ]);
  await db.deleteFrom("insights").where("id", "=", theme.id).execute();
  assert.equal((await members()).length, 0);
  console.log("Populated insight membership upgrade passed");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
    await runtimeState().maintenancePool?.end();
  });
