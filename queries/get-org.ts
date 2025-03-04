"server-only";

import { db } from "@/db/db";
import { getSubdomain } from "@/lib/server/utils";

export const getOrgQuery = async () => {
  try {
    const orgSubdomain = await getSubdomain();

    return await db
      .selectFrom("org")
      .where("org.subdomain", "=", orgSubdomain)
      .select(["id", "name", "isClaimed"])
      .executeTakeFirst();
  } catch (error: any) {
    throw error;
  }
};
