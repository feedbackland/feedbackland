import { upsertOrgQuery as upsertOrgQuery } from "@/queries/upsert-org";
import { z } from "zod";

const schema = z.object({
  orgId: z.string().uuid().describe("The UUID of the organization."),
});

export async function POST(request: Request) {
  try {
    const bodyRaw = await request.json();
    const { orgId } = schema.parse(bodyRaw);

    if (orgId && orgId.length > 0) {
      const org = await upsertOrgQuery({ orgId });
      return Response.json(org);
    } else {
      throw new Error("No subdomain provided");
    }
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to upsert org" },
      { status: 500 },
    );
  }
}
