"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import {
  ActivityFeedItem,
  FeedbackCategory,
  FeedbackOrderBy,
  FeedbackStatus,
} from "@/lib/typings";

export async function getActivityFeedQuery({
  orgId,
  page,
  pageSize,
  orderBy,
  status,
  userId,
}: {
  orgId: string;
  page: number;
  pageSize: number;
  orderBy: FeedbackOrderBy;
  status?: FeedbackStatus;
  userId: string;
}) {
  const offset = (page - 1) * pageSize;

  let feedbackQuery = db
    .selectFrom("feedback")
    .leftJoin("user", "feedback.authorId", "user.id")
    .where("feedback.orgId", "=", orgId);

  if (status) {
    feedbackQuery = feedbackQuery.where("feedback.status", "=", status);
  }

  const feedbackCTE = feedbackQuery.select([
    "feedback.orgId",
    "feedback.id",
    "feedback.id as postId",
    sql<string | null>`null`.as("commentId"),
    "feedback.createdAt",
    "feedback.title",
    "feedback.description as content",
    "feedback.upvotes",
    "feedback.category",
    "feedback.status",
    sql<string>`'post'`.as("type"),
    (eb) =>
      eb
        .selectFrom("comment")
        .select(eb.fn.countAll<string>().as("commentCount"))
        .whereRef("comment.postId", "=", "feedback.id")
        .as("commentCount"),
    "user.id as authorId",
    "user.name as authorName",
    "feedback.title as postTitle",
  ]);

  const commentsCTE = db
    .selectFrom("comment")
    .innerJoin("feedback", "comment.postId", "feedback.id")
    .leftJoin("user", "comment.authorId", "user.id")
    .where("feedback.orgId", "=", orgId)
    .select([
      "feedback.orgId",
      "comment.id",
      "comment.postId",
      "comment.id as commentId",
      "comment.createdAt",
      sql<string>`null`.as("title"),
      "comment.content",
      "comment.upvotes",
      sql<FeedbackCategory | null>`null`.as("category"),
      sql<FeedbackStatus | null>`null`.as("status"),
      sql<string>`'comment'`.as("type"),
      sql<string>`'0'`.as("commentCount"),
      "user.id as authorId",
      "user.name as authorName",
      "feedback.title as postTitle",
    ]);

  const activityQuery = db.selectFrom(
    feedbackCTE.unionAll(commentsCTE).as("activity"),
  );

  let orderedQuery = activityQuery.selectAll("activity");

  if (orderBy === "newest") {
    orderedQuery = orderedQuery.orderBy("activity.createdAt", "desc");
  } else if (orderBy === "upvotes") {
    orderedQuery = orderedQuery.orderBy("activity.upvotes", "desc");
  } else if (orderBy === "comments") {
    orderedQuery = orderedQuery.orderBy("activity.commentCount", "desc");
  } else {
    orderedQuery = orderedQuery.orderBy("activity.createdAt", "desc");
  }

  const finalQuery = orderedQuery
    .leftJoin("activity_seen", (join) =>
      join
        .onRef("activity.id", "=", "activity_seen.itemId")
        .on("activity_seen.userId", "=", userId),
    )
    .selectAll()
    .select((eb) => [
      eb("activity_seen.userId", "is not", null).as("isSeen"),
      eb.fn.count("activity.id").over().as("totalItemsCount"),
    ])
    .limit(pageSize)
    .offset(offset);

  try {
    const results = await finalQuery.execute();

    const items = results;
    const totalItemsCount =
      results.length > 0 ? Number(results[0].totalItemsCount) : 0;
    const itemsWithoutTotalCount: ActivityFeedItem[] = items.map(
      ({ totalItemsCount, isSeen, ...rest }) => {
        return { ...rest, isSeen: Boolean(isSeen) };
      },
    );
    const totalPages = Math.ceil(totalItemsCount / pageSize);

    return {
      items: itemsWithoutTotalCount,
      totalItemsCount,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    throw error;
  }
}
