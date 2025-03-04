"server-only";

import { db } from "@/db/db";

export const getOrgForSubdomainQuery = async (subdomain: string) => {
  try {
    const org = await db
      .selectFrom("org")
      .where("org.subdomain", "=", subdomain)
      .selectAll()
      .executeTakeFirst();

    return org;
  } catch (error: any) {
    throw error;
  }
};
