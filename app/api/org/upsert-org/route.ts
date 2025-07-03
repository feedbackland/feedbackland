import { upsertOrgSchema } from "@/lib/schemas";
import { upsertOrgQuery } from "@/queries/upsert-org";
import { NextResponse, type NextRequest } from "next/server";

const headers = {
  "Access-Control-Allow-Origin": "*", // Allow any origin
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS", // Allow common methods
  "Access-Control-Allow-Headers": "*",
};

// Handler for OPTIONS preflight requests
// note: do not remove the 'request' argument here! Is needed for proper CORS!
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

export async function POST(request: NextRequest) {
  try {
    const bodyRaw = await request.json();
    const { orgId } = upsertOrgSchema.parse(bodyRaw);
    const org = await upsertOrgQuery({ orgId });

    return NextResponse.json(org, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upsert org" },
      { status: 500 },
    );
  }
}
