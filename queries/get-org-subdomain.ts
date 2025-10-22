"server-only";

import { db } from "@/db/db";

export const getOrgSubdomainQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const org = await db
      .selectFrom("org")
      .where("org.id", "=", orgId)
      .select(["org.orgSubdomain"])
      .executeTakeFirstOrThrow();

    return org.orgSubdomain;
  } catch (error) {
    throw error;
  }
};
