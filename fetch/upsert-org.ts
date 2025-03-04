import { Org } from "@/db/schema";

export async function upsertOrgFetch({
  orgId,
}: {
  orgId: string;
}): Promise<Org> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/org/upsert-org`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId }),
      },
    );
    return response.json();
  } catch (error) {
    console.error("Error upserting org:", error);
    throw error;
  }
}
