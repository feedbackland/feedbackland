import { getAllActiveFeedbackPosts } from "@/queries/get-all-active-feedback-posts";
import { convertToModelMessages, streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const maxDuration = 30;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
  const input = await req.json();

  const { orgId } = input;

  const model = openrouter("google/gemini-2.5-flash-lite-preview-09-2025");

  const feedbackPosts = await getAllActiveFeedbackPosts({
    orgId,
  });

  const messages = await convertToModelMessages(input.messages);

  const system = `
    You are a helpful assistant with access to the following feedback posts data:
    
    ${JSON.stringify(feedbackPosts, null, 2)}
    
    Answer questions about this data accurately. If asked about something not in the data, say you don't have that information.
  `;

  const result = streamText({
    model,
    messages,
    system,
  });

  return result.toUIMessageStreamResponse();
}
