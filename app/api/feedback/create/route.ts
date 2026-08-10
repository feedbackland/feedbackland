import { z } from "zod/v4";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { NextResponse, type NextRequest } from "next/server";
import { getClientIp, enforceFeedbackCreateLimit } from "@/lib/rate-limit";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

const schema = z.object({
  orgId: z.uuid(),
  description: z.string().trim().min(1).max(10000),
});

export async function POST(request: NextRequest) {
  try {
    const bodyRaw = await request.json();
    const { orgId, description } = schema.parse(bodyRaw);

    // This endpoint is unauthenticated and every accepted post spends several
    // LLM calls (moderation, titling, embedding). Cap it per source IP and per
    // org so a leaked org id can't run up an unbounded OpenRouter bill.
    const ip = getClientIp(request.headers);
    const { allowed } = await enforceFeedbackCreateLimit({ ip, orgId });

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429, headers },
      );
    }

    const org = await createFeedbackPostQuery({
      authorId: null,
      orgId,
      description,
    });

    return NextResponse.json(org, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create feedback post" },
      { status: 500 },
    );
  }
}
