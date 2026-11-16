import "server-only";
import { z } from "zod/v4";
import { requireSearchBody } from "@/lib/search/transport";
import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedQuery } from "@/queries/get-activity-feed";
import { DomainError } from "@/lib/domain-error";
import {
  feedbackCategoriesSchema,
  feedbackOrderBySchema,
  feedbackStatusSchema,
  searchCursorSchema,
  searchCapabilitySchema,
} from "@/lib/schemas";
export const getActivityFeed = adminProcedure
  .input(
    z.object({
      cursor: z.union([z.number().int().min(1), searchCursorSchema]).nullish(),
      pageSize: z.number().int().min(1).max(100),
      orderBy: feedbackOrderBySchema,
      status: feedbackStatusSchema,
      categories: feedbackCategoriesSchema,
      excludeFeedback: z.boolean(),
      excludeComments: z.boolean(),
      searchValue: z.string().trim().max(500),
      unseenOnly: z.boolean(),
      unscreenedOnly: z.boolean().default(false),
      capability: searchCapabilitySchema.optional(),
    }),
  )
  .query(
    async ({
      input: { cursor, ...input },
      ctx: { userId, sessionId, ip, signal, method },
    }) => {
      requireSearchBody(method, { ...input, cursor });
      if (input.searchValue && typeof cursor === "number")
        throw new DomainError("CONFLICT", "SEARCH_RESTART_REQUIRED");
      const { nextSearchCursor, ...result } = await getActivityFeedQuery({
        ...input,
        page: typeof cursor === "number" ? cursor : 1,
        searchCursor: cursor && typeof cursor === "object" ? cursor : undefined,
        userId,
        sessionId,
        ip,
        signal,
      });
      return {
        ...result,
        nextCursor: result.search
          ? nextSearchCursor
          : result.currentPage < result.totalPages
            ? result.currentPage + 1
            : undefined,
      };
    },
  );
