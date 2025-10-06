import { getAllActiveFeedbackPosts } from "@/queries/get-all-active-feedback-posts";
import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const input = await req.json();

  const { messages, orgId } = input;

  const feedbackPosts = await getAllActiveFeedbackPosts({
    orgId,
  });

  const result = streamText({
    model: google("gemini-2.5-flash-lite-preview-09-2025"),
    messages: convertToModelMessages(messages),
    system: `You are a helpful assistant with access to the following feedback posts data:

${JSON.stringify(feedbackPosts, null, 2)}

Answer questions about this data accurately. If asked about something not in the data, say you don't have that information.`,
  });

  return result.toUIMessageStreamResponse();
}
