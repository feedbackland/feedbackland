import { upsertOrgQuery as upsertOrgQuery } from "@/queries/upsert-org";
// import { z } from "zod";
import { NextResponse } from "next/server";

// const schema = z.object({
//   orgId: z.string().uuid().describe("The UUID of the organization."),
// });

export async function POST(request: Request) {
  try {
    // const bodyRaw = await request.json();
    // const { orgId } = schema.parse(bodyRaw);

    const res = await request.json();
    console.log("res", res);
    const { orgId } = res;
    console.log("orgId", orgId);

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
