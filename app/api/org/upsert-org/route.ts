import { upsertOrgSchema } from "@/lib/schemas";
import { upsertOrgQuery } from "@/queries/upsert-org";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const bodyRaw = await request.json();
    const { orgId } = upsertOrgSchema.parse(bodyRaw);

    if (orgId && orgId.length > 0) {
      const org = await upsertOrgQuery({ orgId });
      return NextResponse.json(org, { status: 200 });
    } else {
      throw new Error("No subdomain provided");
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upsert org" },
      { status: 500 },
    );
  }
}
