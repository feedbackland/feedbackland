import { searchTicket } from "./search-ticket";
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

/** Public and admin readers, including keyless exact search, on the migrated schema. */
export async function readSurfaces(actor: Actor) {
  await db
    .insertInto("feedback")
    .values(
      ["000001", "000002"].map((fraction) => ({
        title: "Cursor precision",
        upvotes: fraction === "000001" ? "7" : "4",
        description: "Cursor precision",
        plainText: "Cursor precision",
        moderationState: "disabled",
        createdAt: `2026-10-18T00:00:00.${fraction}Z`,
      })),
    )
    .execute();
  const [older, newer] = await db
    .selectFrom("feedback")
    .select("id")
    .where("title", "=", "Cursor precision")
    .orderBy("createdAt")
    .execute();
  await db
    .insertInto("comment")
    .values([
      {
        postId: older.id,
        content: "Updated status to planned",
        plainText: "Updated status to planned",
        moderationState: "disabled",
      },
      {
        postId: older.id,
        content: "Updated status to done",
        plainText: "Updated status to done",
        moderationState: "disabled",
      },
      {
        postId: newer.id,
        content: "A reply",
        plainText: "A reply",
        moderationState: "disabled",
      },
    ])
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
  for (const orderBy of ["newest", "upvotes", "comments"] as const) {
    const search = await getFeedbackPostsQuery({
      limit: 20,
      cursor: null,
      orderBy,
      status: null,
      searchValue: "Cursor precision",
      capability: searchTicket(),
    });
    assert.equal(search.search?.mode, "exact");
    const recent = [newer.id, older.id],
      mostVotes = [older.id, newer.id];
    assert.deepEqual(
      search.feedbackPosts.map((p) => p.id),
      orderBy === "newest" ? recent : mostVotes,
    );
    const activity = await getActivityFeedQuery({
      ...actor,
      page: 1,
      pageSize: 20,
      orderBy,
      status: null,
      categories: null,
      excludeFeedback: false,
      excludeComments: false,
      unseenOnly: false,
      searchValue: "Cursor precision",
      capability: searchTicket(),
    });
    assert.equal(activity.search?.mode, "exact");
    // The board counts status entries as comments. Activity excludes them when ranking posts.
    assert.deepEqual(
      activity.items.map((p) => p.id),
      orderBy === "upvotes" ? mostVotes : recent,
    );
  }
}
