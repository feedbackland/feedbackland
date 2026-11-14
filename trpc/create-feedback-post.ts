import "server-only";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "@/lib/trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { enforceFeedbackCreateLimit } from "@/lib/rate-limit";
import { MAX_FEEDBACK_HTML_BYTES } from "@/lib/feedback-text";

export const createFeedbackPost = publicProcedure
  .input(
    z.object({
      descriptionFormat: z.enum(["plain-text", "html"]).default("plain-text"),
      description: z
        .string()
        .max(MAX_FEEDBACK_HTML_BYTES)
        .refine((text) => text.trim().length > 0),
    }),
  )
  .mutation(
    async ({
      input: { description, descriptionFormat },
      ctx: { userId, ip },
    }) => {
      // Share per-source and board limits with the public HTTP endpoint.
      const { allowed } = await enforceFeedbackCreateLimit({ ip });

      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please slow down and try again shortly.",
        });
      }

      return createFeedbackPostQuery({
        description,
        authorId: userId,
        descriptionFormat,
      });
    },
  );
