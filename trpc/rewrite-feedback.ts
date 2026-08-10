import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "@/lib/trpc";
import { LLM_MODEL, REASONING } from "@/lib/utils-server";
import { enforceRewriteLimit } from "@/lib/rate-limit";

export const rewriteFeedback = publicProcedure
  .input(
    z.object({
      description: z.string().trim().min(1).max(10000),
    }),
  )
  .mutation(async ({ input: { description }, ctx: { ip, orgId } }) => {
    // Public and unauthenticated, and each call hits the model. Cap per IP and
    // per org so it can't be looped to burn OpenRouter credit.
    const { allowed } = await enforceRewriteLimit({ ip, orgId });

    if (!allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please slow down and try again shortly.",
      });
    }

    const systemPrompt = `You are a skilled editor who improves user feedback posts. Your job is to rewrite the user's raw feedback into a clear, professional, and well-structured version while preserving their original meaning and intent.

Rules:
- Improve clarity, grammar, spelling, and professionalism
- Make the feedback more concise and actionable
- Preserve the original tone and intent — if the user is frustrated, keep the frustration but express it constructively
- Do NOT add new points or opinions that weren't in the original
- Do NOT remove key details or context
- Structure the feedback logically with clear paragraphs if it's long enough to benefit from it
- Output plain text only — no markdown, no bullet points with special characters, no headers
- Keep the result roughly the same length as the original, or slightly shorter if you can remove redundancy
- If the original is already well-written, only make minor improvements`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: `Please improve this feedback post:\n\n${description}`,
            },
          ],
          // The author is watching a spinner on their own draft. One pass over
          // one piece of text reads the same at every level, so take the fast one.
          reasoning: REASONING.mechanical,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `AI service returned an error (status ${response.status}). Please try again.`,
      );
    }

    const data = await response.json();

    const rewrittenText = data?.choices?.[0]?.message?.content;

    if (!rewrittenText || rewrittenText.trim().length === 0) {
      throw new Error("Invalid or empty response from the AI");
    }

    return { description: rewrittenText.trim() };
  });
