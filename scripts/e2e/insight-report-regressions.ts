import assert from "node:assert/strict";
import { sql } from "kysely";
import { db } from "../../db/db";
import { startInsightsRun } from "../../lib/jobs/insights";
import { getInsightsQuery } from "../../queries/get-insights";
import { getInsightEvidencePage } from "../../trpc/get-insight-evidence";
import { setInsightStatusQuery } from "../../queries/set-insight-status";
import { formatReach } from "../../lib/insights";
import { chat, type mockOpenRouter } from "../mock-llm";
import { insightAnswer, insightRequest } from "./insights-fixture";
import { admin, seed, ended, setBudget, budget } from "./insight-test-support";
type Mock = Awaited<ReturnType<typeof mockOpenRouter>>;
const publish = async () => ended((await startInsightsRun(admin)).id);
async function resetPosts(n: number) {
  await db.deleteFrom("feedback").execute();
  await db.deleteFrom("user_upvote").execute();
  await seed(n);
  await setBudget(0);
}
export async function membershipAndHistory(mock: Mock) {
  await resetPosts(201);
  mock.handler = insightAnswer;
  await publish();
  const [old] = (await getInsightsQuery()).insights;
  await seed(45);
  await publish();
  const [current] = (await getInsightsQuery()).insights;
  assert.equal(old.id, current.id);
  assert.notEqual(old.version, current.version);
  const stale = { insightId: old.id, version: old.version },
    ref = { insightId: current.id, version: current.version };
  await assert.rejects(
    setInsightStatusQuery({ ...admin, ...stale, status: "done" }),
    { code: "CONFLICT" },
  );
  await assert.rejects(getInsightEvidencePage(admin, { ...stale, cursor: 0 }), {
    code: "CONFLICT",
  });
  assert.equal((await getInsightsQuery()).openPostCount, 246);
  const evidence = await getInsightEvidencePage(admin, { ...ref, cursor: 0 });
  await db
    .deleteFrom("feedback")
    .where("id", "=", evidence.posts[0].id)
    .execute();
  await db
    .updateTable("feedback")
    .where("id", "=", evidence.posts[1].id)
    .set({ status: "planned" })
    .execute();
  await assert.rejects(
    setInsightStatusQuery({
      ...ref,
      status: "planned",
      userId: "insight-voter",
      sessionId: "insight-voter",
    }),
    { code: "FORBIDDEN" },
  );
  assert.equal(
    (await setInsightStatusQuery({ ...admin, ...ref, status: "planned" }))
      .postsUpdated,
    244,
  );
  assert.equal(
    (await setInsightStatusQuery({ ...admin, ...ref, status: "planned" }))
      .postsUpdated,
    0,
  );
  const history = await db
    .selectFrom("comment")
    .select(["content", "postId", "authorId"])
    .where("plainText", "=", "Updated status to planned")
    .execute();
  assert.equal(history.length, 244);
  assert(
    history.every(
      (h) => h.authorId === admin.userId && h.content.includes(h.postId),
    ),
  );
  await db
    .updateTable("insights")
    .where("id", "=", old.id)
    .set({ isArchived: true })
    .execute();
  await assert.rejects(
    setInsightStatusQuery({ ...admin, ...ref, status: "done" }),
    { code: "CONFLICT" },
  );
  await assert.rejects(getInsightEvidencePage(admin, { ...ref, cursor: 0 }), {
    code: "CONFLICT",
  });
  await publish();
  const refreshed = (await getInsightsQuery()).insights[0];
  const original = (await getInsightsQuery()).run,
    before = mock.requests;
  for (const status of ["done", "declined"] as const) {
    await db.updateTable("feedback").set({ status }).execute();
    const view = await getInsightsQuery();
    assert.equal(view.insights.length, 0);
    assert.equal(view.openPostCount, 0);
    await assert.rejects(
      setInsightStatusQuery({
        ...admin,
        insightId: refreshed.id,
        version: refreshed.version,
        status: "planned",
      }),
      { code: "CONFLICT" },
    );
    assert.deepEqual(view.run, original);
    await assert.rejects(startInsightsRun(admin), {
      message: "NO_OPEN_FEEDBACK",
    });
  }
  await db.deleteFrom("feedback").execute();
  assert.deepEqual((await getInsightsQuery()).run, original);
  assert.equal((await getInsightsQuery()).insights.length, 0);
  assert.equal(mock.requests, before);
}
export async function pagingAndAnonymous(mock: Mock) {
  await resetPosts(2000);
  mock.handler = insightAnswer;
  await db.updateTable("feedback").set({ authorId: null }).execute();
  await publish();
  const [card] = (await getInsightsQuery()).insights;
  assert.equal(card.postCount, 2000);
  assert.equal(card.reach, 0);
  assert.equal(card.signals?.anonymousPosts, 2000);
  assert.equal(card.signals?.reachScore, 100);
  assert.equal(
    formatReach(card.reach, card.signals?.anonymousPosts),
    "2000 anonymous posts",
  );
  const ref = { insightId: card.id, version: card.version };
  const ids: string[] = [];
  let cursor: number | null = 0;
  do {
    const page = await getInsightEvidencePage(admin, { ...ref, cursor });
    assert.equal(page.posts.length, 50);
    ids.push(...page.posts.map((p) => p.id));
    cursor = page.nextCursor;
    if (ids.length === 50)
      await db
        .updateTable("feedback")
        .set({ upvotes: 500 })
        .where("id", "=", ids[0])
        .execute();
  } while (cursor !== null);
  assert.equal(new Set(ids).size, 2000);
  await db
    .updateTable("feedback")
    .set({ authorId: admin.userId })
    .where("id", "in", ids.slice(0, 2))
    .execute();
  await db
    .insertInto("user_upvote")
    .values([
      { contentId: ids[0], userId: admin.userId },
      { contentId: ids[1], userId: "insight-voter" },
    ])
    .execute();
  await publish();
  const [mixed] = (await getInsightsQuery()).insights;
  assert.equal(mixed.reach, 2);
  assert.equal(mixed.signals?.anonymousPosts, 1998);
  assert.equal(
    formatReach(mixed.reach, mixed.signals?.anonymousPosts),
    "2 people identified · 1998 anonymous posts",
  );
}
export async function mergeAndEmpty(mock: Mock) {
  await resetPosts(801);
  let submitted = 0,
    assigned = 0;
  let repeated = true;
  mock.handler = (wire) => {
    const { items, merge } = insightRequest(wire.body);
    if (merge) {
      submitted = items.length;
      chat(wire.response, 0.001, "stop", '{"groups":[]}');
      return;
    }
    const insights = items.slice(0, 60).map((p, i) => ({
      title: (repeated ? "Theme " + i : "Unique " + p.title) + '"'.repeat(125),
      description: '"'.repeat(700),
      severity: 49,
      ids: [p.id],
    }));
    assigned += insights.length;
    chat(wire.response, 0.001, "stop", JSON.stringify({ insights }));
  };
  const merged = await publish();
  const cards = (await getInsightsQuery()).insights;
  assert.equal(submitted, 60);
  assert.equal(assigned, 241);
  assert.equal(cards.length, 60);
  assert.equal(new Set(cards.map((c) => c.title)).size, 60);
  assert.equal(Number(merged.postsClustered), assigned);
  repeated = false;
  await publish();
  assert.equal(submitted, 200);
  for (const size of [201, 3]) {
    await resetPosts(size);
    mock.handler = insightAnswer;
    await publish();
    mock.handler = (wire) =>
      chat(
        wire.response,
        0.001,
        "stop",
        insightRequest(wire.body).merge ? '{"groups":[]}' : '{"insights":[]}',
      );
    const before = mock.requests;
    const empty = await publish();
    assert.equal(mock.requests - before, size === 3 ? 1 : 3);
    assert.equal(empty.insightCount, "0");
    assert.equal(empty.postsAnalyzed, String(size));
    assert.equal((await getInsightsQuery()).insights.length, 0);
    assert.equal((await getInsightsQuery()).run?.insightCount, 0);
  }
}
export async function popularBoardAndArchive(mock: Mock) {
  await resetPosts(2000);
  mock.handler = insightAnswer;
  await sql`insert into "user"(id,email,name,role,"emailVerified") select 'supporter-'||n,n||'@fixture.invalid','Supporter','user',true from generate_series(1,3000)n`.execute(
    db,
  );
  await sql`with posts as materialized (select id,(row_number() over(order by id)-1)::int as n from feedback)
    insert into user_upvote("contentId","userId") select id,'supporter-'||((n*133+j*7)%3000+1)
    from posts cross join generate_series(1,500)j`.execute(db);
  await sql`analyze user_upvote`.execute(db);
  await sql`insert into insights(title,description,ids,"isArchived")
    select 'Archive '||n,'History',array(select md5(n::text||'-'||m::text)::uuid::text from generate_series(1,40)m),true
    from generate_series(1,10500)n`.execute(db);
  await sql`insert into insights(title,description,ids,"isArchived")
    select 'Overlapping '||n,'History',array(select id::text from feedback order by id limit 40),true
    from generate_series(1,500)n`.execute(db);
  await sql`analyze insight_member`.execute(db);
  const before = mock.requests;
  const [a, b] = await Promise.all([
    startInsightsRun(admin),
    startInsightsRun(admin),
  ]);
  assert.equal(a.id, b.id);
  const result = await ended(a.id),
    [theme] = (await getInsightsQuery()).insights;
  assert(Number(result.postsAnalyzed) > 1000);
  assert.equal(theme.postCount, Number(result.postsAnalyzed));
  const expected = await sql<{
    n: number;
  }>`select count(distinct person)::int as n from (
    select u."userId" as person from insight_member m join user_upvote u on u."contentId"=m."postId" where m."insightId"=${theme.id}
    union all select f."authorId" from insight_member m join feedback f on f.id=m."postId" where m."insightId"=${theme.id}
  ) supporters`.execute(db);
  assert.equal(theme.reach, expected.rows[0].n);
  assert.equal(mock.requests - before, await budget(a.id));
  assert.equal(
    mock.requests - before,
    Math.ceil(Number(result.postsAnalyzed) / 200) + 1,
  );
  // One exceptionally busy post still has a finite index scan and a truthful lower bound.
  await resetPosts(1);
  const only = await db
    .selectFrom("feedback")
    .select("id")
    .executeTakeFirstOrThrow();
  await sql`insert into user_upvote("userId","contentId") select id,${only.id} from "user" where id like 'supporter-%'`.execute(
    db,
  );
  await sql`insert into comment("postId",content,"plainText","moderationState") select ${only.id},'Discussion','Discussion','screened' from generate_series(1,1100)`.execute(
    db,
  );
  await publish();
  const [limited] = (await getInsightsQuery()).insights;
  assert.equal(limited.signals?.votesLimited, true);
  assert.equal(limited.signals?.commentsLimited, true);
  assert.equal(limited.signals?.recentUpvotes, 1024);
  assert.equal(limited.signals?.recentCommentCount, 1024);
  assert.equal(limited.reach, 1025);
  assert.equal(formatReach(limited.reach, 0, true), "At least 1025 people");
}
