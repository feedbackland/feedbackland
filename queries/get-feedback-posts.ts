"server-only";

import { db } from "@/db/db";
import { sql } from "kysely"; // Import sql
import {
  FeedbackOrderBy,
  FeedbackPostsCursor,
  FeedbackStatus,
} from "@/lib/typings";

export const getFeedbackPostsQuery = async ({
  orgId,
  userId,
  limit,
  cursor,
  orderBy,
  status,
}: {
  orgId: string;
  userId?: string | null;
  limit: number;
  cursor: FeedbackPostsCursor | null | undefined;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
}) => {
  try {
    let query = db
      .with("feedback_with_comment_count", (db) =>
        db
          .selectFrom("feedback")
          .select([
            "feedback.id",
            "feedback.createdAt",
            "feedback.updatedAt",
            "feedback.orgId",
            "feedback.authorId",
            "feedback.category",
            "feedback.title",
            "feedback.description",
            "feedback.upvotes",
            "feedback.status",
            (eb) =>
              eb.fn
                .coalesce(
                  eb
                    .selectFrom("comment")
                    .select(eb.fn.countAll<string>().as("count"))
                    .whereRef("comment.postId", "=", "feedback.id"),
                  sql<number>`0`, // Fallback value 0
                )
                .as("commentCount"),
          ])
          .where("feedback.orgId", "=", orgId),
      )
      .selectFrom("feedback_with_comment_count")
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback_with_comment_count.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId || null),
      )
      .select([
        "feedback_with_comment_count.id",
        "feedback_with_comment_count.createdAt",
        "feedback_with_comment_count.updatedAt",
        "feedback_with_comment_count.orgId",
        "feedback_with_comment_count.authorId",
        "feedback_with_comment_count.category",
        "feedback_with_comment_count.title",
        "feedback_with_comment_count.description",
        "feedback_with_comment_count.upvotes",
        "feedback_with_comment_count.commentCount",
        "feedback_with_comment_count.status",
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId || null)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
      ]);

    if (status) {
      query = query.where("feedback_with_comment_count.status", "=", status);
    }

    if (orderBy === "newest") {
      query = query
        .orderBy("feedback_with_comment_count.createdAt", "desc")
        .orderBy("feedback_with_comment_count.id", "desc");

      if (cursor) {
        query = query.where((eb) =>
          eb.or([
            eb(
              "feedback_with_comment_count.createdAt",
              "<",
              new Date(cursor.createdAt),
            ),
            eb.and([
              eb(
                "feedback_with_comment_count.createdAt",
                "=",
                new Date(cursor.createdAt),
              ),
              eb("feedback_with_comment_count.id", "<", cursor.id),
            ]),
          ]),
        );
      }
    } else if (orderBy === "upvotes") {
      query = query
        .orderBy("feedback_with_comment_count.upvotes", "desc")
        .orderBy("feedback_with_comment_count.id", "desc");

      if (cursor) {
        query = query.where((eb) =>
          eb.or([
            eb(
              "feedback_with_comment_count.upvotes",
              "<",
              String(cursor.upvotes),
            ),
            eb.and([
              eb(
                "feedback_with_comment_count.upvotes",
                "=",
                String(cursor.upvotes),
              ),
              eb("feedback_with_comment_count.id", "<", cursor.id),
            ]),
          ]),
        );
      }
    } else if (orderBy === "comments") {
      query = query
        .orderBy("feedback_with_comment_count.commentCount", "desc")
        .orderBy("feedback_with_comment_count.id", "desc");

      if (cursor) {
        query = query.where((eb) =>
          eb.or([
            eb(
              "feedback_with_comment_count.commentCount",
              "<",
              cursor.commentCount,
            ),
            eb.and([
              eb(
                "feedback_with_comment_count.commentCount",
                "=",
                cursor.commentCount,
              ),
              eb("feedback_with_comment_count.id", "<", cursor.id),
            ]),
          ]),
        );
      }
    }

    const feedbackPosts = await query.limit(limit + 1).execute();

    let nextCursor: typeof cursor | undefined = undefined;

    if (feedbackPosts.length > limit) {
      const nextItem = feedbackPosts.pop();

      if (nextItem) {
        nextCursor = {
          id: nextItem.id,
          commentCount: Number(nextItem.commentCount),
          upvotes: Number(nextItem.upvotes),
          createdAt: nextItem.createdAt.toISOString(),
        };
      }
    }

    return {
      feedbackPosts,
      nextCursor,
    };
  } catch (error: any) {
    throw error;
  }
};
