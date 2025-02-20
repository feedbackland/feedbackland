"server-only";

import { db } from "@/db/db";

export const getOrg = async ({ orgSubdomain }: { orgSubdomain: string }) => {
  return await db
    .selectFrom("org")
    .where("org.subdomain", "=", orgSubdomain)
    .select(["id", "name", "isClaimed"])
    .executeTakeFirst();
};

export const getIsAdmin = async ({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) => {
  try {
    const response = await db
      .selectFrom("user_org")
      .where("userId", "=", userId)
      .where("orgId", "=", orgId)
      .select(["role"])
      .executeTakeFirst();

    return response?.role === "admin";
  } catch {
    return false;
  }
};

export const updateVerification = async ({
  identifier,
  value,
}: {
  identifier: string;
  value: string;
}) => {
  const record = await db
    .selectFrom("verification")
    .selectAll()
    .where("identifier", "=", identifier)
    .where("value", "=", value)
    .executeTakeFirst();

  if (!record) {
    return false; // No record found
  }

  // Parse the ISO date string into a Date object
  const currentExpiresAt = new Date(record.expiresAt);

  // Increment the date by one day
  currentExpiresAt.setDate(currentExpiresAt.getDate() + 2);

  // Convert back to ISO date string (YYYY-MM-DD)
  const newExpiresAt = currentExpiresAt.toISOString().split("T")[0];

  const updateResult = await db
    .updateTable("verification")
    .set({ expiresAt: newExpiresAt })
    .where("identifier", "=", identifier)
    .where("value", "=", value)
    .returning(["expiresAt"])
    .executeTakeFirst();

  if (!updateResult) {
    return false; // Update failed (shouldn't happen if the select succeeded, but good to check)
  }

  return true;
};
