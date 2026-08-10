import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "@/lib/trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { enforceFeedbackCreateLimit } from "@/lib/rate-limit";

export const createFeedbackPost = publicProcedure
  .input(
    z.object({
      description: z.string().trim().min(1).max(10000),
    }),
  )
  .mutation(
    async ({ input: { description }, ctx: { userId, orgId, ip } }) => {
      try {
        // Creating a post spends several LLM calls, and this procedure is
        // public. Cap per source IP and per org so it can't be used to burn
        // OpenRouter credit. Shares its buckets with the public HTTP endpoint.
        const { allowed } = await enforceFeedbackCreateLimit({ ip, orgId });

        if (!allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Too many requests. Please slow down and try again shortly.",
          });
        }

        return await createFeedbackPostQuery({
          description,
          authorId: userId,
          orgId,
        });
      } catch (error) {
        throw error;
      }
    },
  );
