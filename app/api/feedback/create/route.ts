import { z } from "zod/v4";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { getClientIp, enforceFeedbackCreateLimit } from "@/lib/rate-limit";
import { ContentInputError } from "@/lib/utils-server";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
const schema = z.object({ description: z.string().trim().min(1).max(10000) });
export async function POST(request: Request) {
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "INVALID_INPUT" },
      { status: 400, headers: cors },
    );
  }
  if (
    !(
      await enforceFeedbackCreateLimit({
        ip: getClientIp(request.headers),
        source: "api",
      })
    ).allowed
  )
    return Response.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: cors },
    );
  try {
    const { id } = await createFeedbackPostQuery({
      description: input.description,
      authorId: null,
    });
    return Response.json({ id }, { status: 201, headers: cors });
  } catch (error) {
    return Response.json(
      { error: "CONTENT_UNAVAILABLE" },
      { status: error instanceof ContentInputError ? 400 : 500, headers: cors },
    );
  }
}
