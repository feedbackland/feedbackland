"server-only";

import { db } from "@/db/db";
import { createOrgQuery } from "./create-org";

export const upsertOrgQuery = async ({ orgId }: { orgId: string }) => {
  try {
    let org = await db
      .selectFrom("org")
      .select(["orgSubdomain"])
      .where("id", "=", orgId)
      .executeTakeFirst();

    if (!org) {
      org = await createOrgQuery();
    }

    return org.orgSubdomain;
  } catch (error) {
    throw error;
  }
};
