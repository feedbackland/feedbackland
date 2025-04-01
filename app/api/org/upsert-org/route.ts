import { upsertOrgSchema } from "@/lib/schemas";
import { upsertOrgQuery } from "@/queries/upsert-org";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const bodyRaw = await request.json();
    const { orgId } = upsertOrgSchema.parse(bodyRaw);

    console.log("upsertOrg route handler orgId", orgId);

    const org = await upsertOrgQuery({ orgId });

    console.log("upsertOrg route handler org", org);

    return NextResponse.json(org);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upsert org" },
      { status: 500 },
    );
  }
}
