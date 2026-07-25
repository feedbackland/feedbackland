"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";

export const getCommentsQuery = async ({
  orgId,
  postId,
  userId,
  limit,
  cursor,
}: {
  orgId: string;
  postId: string;
  userId?: string | null;
  limit: number;
  cursor: { id: string; createdAt: string } | null | undefined;
}) => {
  try {
    let query = db
      .selectFrom("comment")
      .leftJoin("user", (join) =>
        join.onRef("comment.authorId", "=", "user.id"),
      )
      .leftJoin("user_org", (join) =>
        join
          .onRef("comment.authorId", "=", "user_org.userId")
          .on("user_org.orgId", "=", orgId),
      )
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("comment.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId || null),
      )
      .select([
        "comment.id",
        "comment.parentCommentId",
        "comment.postId",
        "comment.createdAt",
        "comment.updatedAt",
        "comment.authorId",
        "comment.content",
        "comment.upvotes",
        "user.name as authorName",
        "user.photoURL as authorPhotoURL",
        "user_org.role as authorRole",
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId || null)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
        // createdAt is stored to microseconds but the driver hands back a JS
        // Date, which only holds milliseconds. Paging on the rounded value
        // strands every comment inside the cursor's millisecond, so keep an
        // exact copy for the cursor. Stripped again before returning.
        sql<string>`to_char(${sql.ref("comment.createdAt")} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as(
          "createdAtExact",
        ),
      ])
      .where("comment.postId", "=", postId);

    if (cursor) {
      // Compare against the exact stored timestamp rather than reconstructing a
      // Date, which would round to milliseconds again. id breaks ties so the
      // sort is total and two comments in the same instant cannot hide each
      // other across a page boundary.
      const at = sql<Date>`${cursor.createdAt}::timestamptz`;

      query = query.where((eb) =>
        eb.or([
          eb("comment.createdAt", "<", at),
          eb.and([
            eb("comment.createdAt", "=", at),
            eb("comment.id", "<", cursor.id),
          ]),
        ]),
      );
    }

    query = query
      .orderBy("comment.createdAt", "desc")
      .orderBy("comment.id", "desc")
      .limit(limit + 1);

    const rows = await query.execute();

    // createdAtExact exists only to build the cursor; keep it off the wire.
    const comments = rows.map(
      ({ createdAtExact: _createdAtExact, ...comment }) => comment,
    );

    let nextCursor: typeof cursor | undefined = undefined;

    if (rows.length > limit) {
      // Drop the look-ahead row, then key the cursor off the last row actually
      // being returned. Keying it off the look-ahead row lost that row: the
      // next page asks for createdAt strictly older than the cursor, so the
      // comment the cursor pointed at was skipped.
      rows.pop();
      comments.pop();

      const lastItem = rows[rows.length - 1];

      if (lastItem) {
        nextCursor = {
          id: lastItem.id,
          createdAt: lastItem.createdAtExact,
        };
      }
    }

    return {
      comments,
      nextCursor,
    };
  } catch (error) {
    throw error;
  }
};
