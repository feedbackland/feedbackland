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

    console.log("org1", org);

    if (!org) {
      org = await createOrgQuery();
    }

    console.log("org2", org);

    return org.orgSubdomain;
  } catch (error) {
    throw error;
  }
};
