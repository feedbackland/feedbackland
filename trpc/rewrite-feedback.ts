import { z } from "zod/v4";
import { publicProcedure } from "@/lib/trpc";

export const rewriteFeedback = publicProcedure
  .input(
    z.object({
      description: z.string().trim().min(1).max(10000),
    }),
  )
  .mutation(async ({ input: { description } }) => {
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
          model: "google/gemini-3.1-flash-lite-preview",
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
          temperature: 0.3,
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
