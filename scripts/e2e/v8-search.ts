import assert from "node:assert/strict";
import { db } from "../../db/db";
import { getFeedbackPostsQuery } from "../../queries/get-feedback-posts";
import { getFeedbackPostQuery } from "../../queries/get-feedback-post";
import { getCommentsQuery } from "../../queries/get-comments";
import { getActivityFeedQuery } from "../../queries/get-activity-feed";
import { getActivityFeedMetaDataQuery } from "../../queries/get-activity-feed-meta-data";
import { getInsightsQuery } from "../../queries/get-insights";
import type { Actor } from "../../lib/auth/authorization";
import type { FeedbackPostsCursor, FeedbackOrderBy } from "../../lib/typings";

/** Phase 1 read/caller regression checks. Exact/semantic search remains disabled. */
export async function readSurfaces(actor: Actor) {
  await db
    .insertInto("feedback")
    .values(
      ["000001", "000002"].map((fraction) => ({
        title: "Cursor precision",
        description: "Cursor precision",
        plainText: "Cursor precision",
        moderationState: "disabled",
        createdAt: `2026-10-18T00:00:00.${fraction}Z`,
      })),
    )
    .execute();
  const expected = (await db.selectFrom("feedback").select("id").execute())
    .map((row) => row.id)
    .sort();
  for (const orderBy of [
    "newest",
    "upvotes",
    "comments",
  ] as FeedbackOrderBy[]) {
    let cursor: FeedbackPostsCursor = null;
    const actual: string[] = [];
    do {
      const page = await getFeedbackPostsQuery({
        limit: 2,
        cursor,
        orderBy,
        status: null,
        searchValue: "",
        userId: null,
      });
      actual.push(...page.feedbackPosts.map((post) => post.id));
      cursor = page.nextCursor ?? null;
      assert(
        actual.length <= expected.length,
        "Pagination repeated or failed to terminate",
      );
    } while (cursor);
    assert.deepEqual([...actual].sort(), expected);
  }
  const post = await getFeedbackPostQuery({
    postId: expected[0],
    userId: null,
  });
  assert.equal(post.id, expected[0]);
  assert.equal(post.hasUserUpvote, false);
  await getCommentsQuery({
    postId: expected[0],
    limit: 20,
    cursor: null,
    userId: null,
  });
  for (const orderBy of [
    "newest",
    "upvotes",
    "comments",
  ] as FeedbackOrderBy[]) {
    const page = await getActivityFeedQuery({
      userId: actor.userId,
      page: 1,
      pageSize: 20,
      orderBy,
      status: null,
      categories: null,
      excludeFeedback: false,
      excludeComments: false,
      searchValue: "",
      unseenOnly: false,
    });
    assert(page.items.length > 0);
  }
  assert(
    (await getActivityFeedMetaDataQuery({ userId: actor.userId }))
      .totalUnseenCount > 0,
  );
  assert((await getInsightsQuery()).openPostCount > 0);
  const search = await getFeedbackPostsQuery({
    limit: 20,
    cursor: null,
    orderBy: "newest",
    status: null,
    searchValue: "fixture",
    userId: null,
  });
  assert.deepEqual(search.feedbackPosts, []);
}
