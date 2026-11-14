import { z } from "zod/v4";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { getClientIp, enforceFeedbackCreateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/domain-error";
import {
  BodyError,
  boundedRequest,
  discardBody,
} from "@/lib/http/limited-body";
import { isSetupComplete } from "@/lib/setup-state";
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
  if (!(await isSetupComplete())) {
    discardBody(request);
    return Response.json(
      { error: "SETUP_REQUIRED" },
      { status: 403, headers: cors },
    );
  }
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(
      await (await boundedRequest(request, 256 * 1024)).json(),
    );
  } catch (error) {
    if (error instanceof BodyError) return error.response(cors);
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
      signal: request.signal,
    });
    return Response.json({ id }, { status: 201, headers: cors });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DomainError ? error.message : "CONTENT_UNAVAILABLE",
      },
      {
        status: error instanceof DomainError ? error.status : 500,
        headers:
          error instanceof DomainError && error.retryAfterSeconds
            ? { ...cors, "Retry-After": String(error.retryAfterSeconds) }
            : cors,
      },
    );
  }
}
