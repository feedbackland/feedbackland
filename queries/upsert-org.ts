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
      org = await createOrgQuery({ orgId });
    }

    const subdomain = org?.orgSubdomain;

    if (subdomain) {
      return subdomain;
    } else {
      throw new Error("No subdomain found");
    }
  } catch (error) {
    throw error;
  }
};
