"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import { cosineDistance } from "pgvector/kysely";
import {
  FeedbackOrderBy,
  FeedbackPostsCursor,
  FeedbackStatus,
} from "@/lib/typings";
import { generateVector } from "@/lib/utils-server";

export const getFeedbackPostsQuery = async ({
  orgId,
  userId,
  limit,
  cursor,
  orderBy,
  status,
  searchValue,
}: {
  orgId: string;
  userId?: string | null;
  limit: number;
  cursor: FeedbackPostsCursor | null | undefined;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  searchValue: string;
}) => {
  try {
    const isSearching = searchValue.length > 0;
    const maxDistance = 0.5;
    const searchVector = isSearching ? await generateVector(searchValue) : [];

    let query = db
      .selectFrom("feedback")
      .where("feedback.orgId", "=", orgId)
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId || null),
      )
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
          eb
            .selectFrom("comment")
            .select(eb.fn.countAll<string>().as("commentCount"))
            .whereRef("comment.postId", "=", "feedback.id")
            .as("commentCount"),
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId || null)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
        isSearching
          ? cosineDistance("feedback.embedding", searchVector).as("distance")
          : sql<null>`null`.as("distance"),
      ]);

    if (isSearching) {
      query = query
        .where(
          cosineDistance("feedback.embedding", searchVector),
          "<",
          maxDistance,
        )
        .orderBy(sql.ref("distance"));

      if (cursor && typeof cursor.distance === "number") {
        query = query.where(
          cosineDistance("feedback.embedding", searchVector),
          "<",
          cursor.distance,
        );
      }
    } else {
      if (status) {
        query = query.where("feedback.status", "=", status);
      }

      switch (orderBy) {
        case "newest":
          query = query
            .orderBy("feedback.createdAt", "desc")
            .orderBy("feedback.id", "desc");
          break;
        case "upvotes":
          query = query
            .orderBy("feedback.upvotes", "desc")
            .orderBy("feedback.id", "desc");
          break;
        case "comments":
          query = query
            .orderBy("commentCount", "desc")
            .orderBy("feedback.id", "desc");
          break;
        default:
          throw new Error(`Unsupported orderBy value: ${orderBy}`);
      }

      if (cursor) {
        query = query.where((eb) => {
          switch (orderBy) {
            case "newest":
              return eb.or([
                eb("feedback.createdAt", "<", new Date(cursor.createdAt)),
                eb.and([
                  eb("feedback.createdAt", "=", new Date(cursor.createdAt)),
                  eb("feedback.id", "<", cursor.id),
                ]),
              ]);
            case "upvotes":
              const cursorUpvotesStr = String(cursor.upvotes);
              return eb.or([
                eb("feedback.upvotes", "<", cursorUpvotesStr),
                eb.and([
                  eb("feedback.upvotes", "=", cursorUpvotesStr),
                  eb("feedback.id", "<", cursor.id),
                ]),
              ]);
            case "comments":
              const cursorCommentCount = Number(cursor.commentCount);
              return eb.or([
                eb(
                  (eb) =>
                    eb
                      .selectFrom("comment")
                      .select(eb.fn.countAll().as("commentCount"))
                      .whereRef("comment.postId", "=", "feedback.id"),
                  "<",
                  cursorCommentCount,
                ),
                eb.and([
                  eb(
                    (eb) =>
                      eb
                        .selectFrom("comment")
                        .select(eb.fn.countAll().as("commentCount"))
                        .whereRef("comment.postId", "=", "feedback.id"),
                    "=",
                    cursorCommentCount,
                  ),
                  eb("feedback.id", "<", cursor.id),
                ]),
              ]);
            default:
              const innerExhaustiveCheck: never = orderBy;
              throw new Error(
                `Unsupported orderBy value in cursor logic: ${innerExhaustiveCheck}`,
              );
          }
        });
      }
    }

    query = query.limit(limit + 1);

    const feedbackPosts = await query.execute();

    let nextCursor: FeedbackPostsCursor | undefined = undefined;

    if (feedbackPosts.length > limit) {
      const nextItem = feedbackPosts.pop();

      if (nextItem) {
        nextCursor = {
          id: nextItem.id,
          commentCount: Number(nextItem.commentCount),
          upvotes: Number(nextItem.upvotes),
          createdAt: nextItem.createdAt.toISOString(),
          distance:
            isSearching && nextItem.distance
              ? Number(nextItem.distance)
              : undefined,
        };
      }
    }

    return {
      feedbackPosts,
      nextCursor,
    };
  } catch (error: any) {
    console.error("Error in getFeedbackPostsQuery:", error);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve feedback posts. Reason: ${reason}`);
  }
};
