import { getOrgSubdomainQuery } from "@/queries/get-org-subdomain";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

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

export async function GET(request: NextRequest) {
  try {
    const bodyRaw = await request.json();
    const { orgId } = z
      .object({
        orgId: z.uuid(),
      })
      .parse(bodyRaw);
    const org = await getOrgSubdomainQuery({ orgId });

    return NextResponse.json(org, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Failed to get org subdomain: ${error instanceof Error ? error?.message : `Unknown error`}`,
      },
      { status: 500 },
    );
  }
}
