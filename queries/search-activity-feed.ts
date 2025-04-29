"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import { textEmbeddingModel } from "@/lib/gemini";
import { cosineDistance } from "pgvector/kysely";
import {
  ActivityFeedItem,
  FeedbackCategories,
  FeedbackCategory,
  FeedbackStatus,
} from "@/lib/typings";

export const searchActivityFeedQuery = async ({
  orgId,
  searchValue,
  page,
  pageSize,
  categories,
  excludeFeedback = false,
  excludeComments = false,
}: {
  orgId: string;
  searchValue: string;
  page: number;
  pageSize: number;
  categories?: FeedbackCategories;
  excludeFeedback?: boolean;
  excludeComments?: boolean;
}) => {
  const {
    embedding: { values },
  } = await textEmbeddingModel.embedContent(searchValue);

  const offset = (page - 1) * pageSize;
  const distanceThreshold = 0.5;

  let feedbackQuery = db
    .selectFrom("feedback")
    .leftJoin("user", "feedback.authorId", "user.id")
    .where("feedback.orgId", "=", orgId)
    .where(
      cosineDistance("feedback.embedding", values),
      "<",
      distanceThreshold,
    );

  if (categories && categories.length > 0) {
    feedbackQuery = feedbackQuery.where("feedback.category", "in", categories);
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
    cosineDistance("feedback.embedding", values).as("distance"),
  ]);

  const commentsCTE = db
    .selectFrom("comment")
    .innerJoin("feedback", "comment.postId", "feedback.id")
    .leftJoin("user", "comment.authorId", "user.id")
    .where("feedback.orgId", "=", orgId)
    .where(cosineDistance("comment.embedding", values), "<", distanceThreshold)
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
      cosineDistance("comment.embedding", values).as("distance"),
    ]);

  let activityQuery = db.selectFrom(
    feedbackCTE.unionAll(commentsCTE).as("activity"),
  );

  if (excludeFeedback) {
    activityQuery = db.selectFrom(commentsCTE.as("activity"));
  } else if (excludeComments) {
    activityQuery = db.selectFrom(feedbackCTE.as("activity"));
  }

  const finalQuery = activityQuery
    .selectAll("activity")
    .orderBy("activity.distance")
    .select((eb) => [eb.fn.count("activity.id").over().as("totalItemsCount")])
    .limit(pageSize)
    .offset(offset);

  try {
    const results = await finalQuery.execute();

    // Extract items and total count from the first result (if any)
    const items = results;
    const totalItems =
      results.length > 0 ? Number(results[0].totalItemsCount) : 0;
    const count = totalItems.toString(); // Keep original count format if needed

    // Remove totalCount from individual items before returning
    // Also remove distance if it's not needed in the final result set
    const itemsWithoutExtras: ActivityFeedItem[] = items.map(
      ({ totalItemsCount, distance, ...rest }) => rest,
    );

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      items: itemsWithoutExtras,
      count, // Return the total count as a string
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    throw error;
  }
};
