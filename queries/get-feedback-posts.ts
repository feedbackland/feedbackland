"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import { cosineDistance } from "pgvector/kysely";
import {
  FeedbackOrderBy,
  FeedbackPostsCursor,
  FeedbackStatus,
} from "@/lib/typings";
import { generateQueryVector } from "@/lib/utils-server";

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
    const maxDistance = 0.4;
    const searchVector = isSearching ? await generateQueryVector(searchValue) : [];

    if (isSearching && !searchVector) {
      return { feedbackPosts: [], nextCursor: undefined };
    }

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
        // createdAt is stored to microseconds, but the driver hands back a JS
        // Date, which only holds milliseconds. Paging on the rounded value
        // silently strands every row inside the cursor's millisecond, so keep
        // an exact copy for the cursor. Stripped again before returning.
        sql<string>`to_char(${sql.ref("feedback.createdAt")} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as(
          "createdAtExact",
        ),
      ]);

    if (status) {
      query = query.where("feedback.status", "=", status);
    }

    if (isSearching) {
      query = query
        .where(
          cosineDistance("feedback.embedding", searchVector),
          "<",
          maxDistance,
        )
        .orderBy(sql.ref("distance"))
        .orderBy("feedback.id", "desc");

      if (cursor && typeof cursor.distance === "number") {
        // Search orders by distance ascending, so the next page is the rows
        // *further* from the query than the cursor. Comparing "<" here walked
        // backwards into rows already returned, so the list never advanced and
        // never ran out. The id tiebreak stays "<" because id is ordered desc.
        query = query.where((eb) =>
          eb.or([
            eb(
              cosineDistance("feedback.embedding", searchVector),
              ">",
              cursor.distance,
            ),
            eb.and([
              eb(
                cosineDistance("feedback.embedding", searchVector),
                "=",
                cursor.distance,
              ),
              eb("feedback.id", "<", cursor.id),
            ]),
          ]),
        );
      }
    } else {
      // orderBy is nullable app-wide (FeedbackOrderBy) and the activity feed
      // already reads null as the default ordering. Match it: a caller that
      // omits a sort should get the default list, not a failed request.
      const sortBy = orderBy ?? "newest";

      switch (sortBy) {
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
        default: {
          const exhaustiveCheck: never = sortBy;
          throw new Error(`Unsupported orderBy value: ${exhaustiveCheck}`);
        }
      }

      if (cursor) {
        query = query.where((eb) => {
          switch (sortBy) {
            case "newest": {
              // Compare against the exact stored timestamp, not `new Date(...)`
              // — that would round to milliseconds again and drop the rows this
              // cursor is meant to resume from.
              const at = sql<Date>`${cursor.createdAt}::timestamptz`;

              return eb.or([
                eb("feedback.createdAt", "<", at),
                eb.and([
                  eb("feedback.createdAt", "=", at),
                  eb("feedback.id", "<", cursor.id),
                ]),
              ]);
            }
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
              const innerExhaustiveCheck: never = sortBy;
              throw new Error(
                `Unsupported orderBy value in cursor logic: ${innerExhaustiveCheck}`,
              );
          }
        });
      }
    }

    query = query.limit(limit + 1);

    const rows = await query.execute();

    // createdAtExact exists only to build the cursor; keep it off the wire.
    const feedbackPosts = rows.map(
      ({ createdAtExact: _createdAtExact, ...post }) => post,
    );

    let nextCursor: FeedbackPostsCursor | undefined = undefined;

    if (rows.length > limit) {
      // Drop the look-ahead row, then key the cursor off the last row actually
      // being returned. Keying it off the look-ahead row lost that row: the
      // next page filters strictly past the cursor, so the row the cursor
      // pointed at was skipped -- one post per page boundary.
      rows.pop();
      feedbackPosts.pop();

      const lastItem = rows[rows.length - 1];

      if (lastItem) {
        nextCursor = {
          id: lastItem.id,
          commentCount: Number(lastItem.commentCount),
          upvotes: Number(lastItem.upvotes),
          createdAt: lastItem.createdAtExact,
          // Test the type, not truthiness: `<=>` returns double precision and
          // an exact embedding match is 0, which would drop `distance` from the
          // cursor. The next page's guard would then find no distance, apply no
          // cursor predicate at all, and hand back page one forever.
          distance:
            isSearching && typeof lastItem.distance === "number"
              ? lastItem.distance
              : undefined,
        };
      }
    }

    return {
      feedbackPosts,
      nextCursor,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve feedback posts. Reason: ${reason}`);
  }
};
