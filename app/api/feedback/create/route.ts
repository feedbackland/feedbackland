import { z } from "zod/v4";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { NextResponse, type NextRequest } from "next/server";

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
