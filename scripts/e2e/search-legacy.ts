import assert from "node:assert/strict";
import { sql } from "kysely";
import { db } from "../../db/db";
import { physicalVector } from "../../db/vector";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import {
  materialize,
  prepareSemanticScan,
  semanticCandidates,
  type SearchScope,
} from "../../lib/search/candidates";

async function main() {
  const boot = await migrateAndSeed();
  runtimeState().authSecret = boot.authSecret;
  const physical = await physicalVector(db);
  assert(physical?.indexesValid);
  assert.equal(physical.version, "0.7.4");
  const scope: SearchScope = {
    surface: "activity",
    userId: null,
    filters: { orderBy: "newest", status: null },
  };
  const semantic = { vector: [1, 1, 1], physical, maxDistance: 0.55 };
  await sql`insert into feedback(title,description,"plainText",embedding,"moderationState")
    select 'Indexed '||n,'Body','Body',('[1,'||(1+n::float/1500)||',1]')::vector,'disabled' from generate_series(1,905)n`.execute(
    db,
  );
  await sql`insert into feedback(title,description,"plainText","embeddingSkipped","moderationState")
    values ('Legacy exact marker','Body','Body',true,'disabled')`.execute(db);
  await sql`analyze feedback`.execute(db);
  await db.transaction().execute(async (trx) => {
    await sql`set local enable_seqscan=off`.execute(trx);
    const cap = await prepareSemanticScan(trx, physical.version);
    assert.equal(cap, 400);
    assert.deepEqual(
      (
        await sql`select current_setting('hnsw.ef_search') as ef, current_setting('hnsw.iterative_scan',true) as iterative`.execute(
          trx,
        )
      ).rows[0],
      { ef: "400", iterative: null },
    );
    const query = semanticCandidates(scope, semantic, cap + 1);
    assert(query);
    const plan = JSON.stringify(
      (await sql`explain (format json) ${query}`.execute(trx)).rows,
    );
    for (const name of ["feedback_embedding_idx", "comment_embedding_idx"])
      assert(plan.includes(name));
    const snapshot = await materialize(
      trx,
      scope,
      "Legacy exact marker",
      semantic,
    );
    const ranked = snapshot.results.filter((r) => r[2] !== null);
    assert.equal(ranked.length, 400);
    assert.equal(new Set(ranked.map((r) => r[1])).size, 400);
    assert.deepEqual(
      ranked,
      [...ranked].sort((a, b) => a[2]! - b[2]! || a[1].localeCompare(b[1])),
    );
    assert.equal(snapshot.results.length, 401);
    assert.equal(snapshot.results.at(-1)?.[2], null);
    assert(snapshot.truncated);
  });
  console.log("Legacy pgvector 0.7.4 verified");
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
