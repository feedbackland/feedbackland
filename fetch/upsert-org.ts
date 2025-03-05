import { Org } from "@/db/schema";

export async function fetchUpsertOrg({
  orgId,
  baseUrl = "",
}: {
  orgId: string;
  baseUrl?: string;
}) {
  try {
    const response = await fetch(`${baseUrl}/api/org/upsert-org`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orgId }),
    });

    const org: Org = await response.json();

    return org;
  } catch (error) {
    console.error("Error upserting org:", error);
    throw error;
  }
}
