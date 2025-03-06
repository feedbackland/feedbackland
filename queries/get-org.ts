"server-only";

import { db } from "@/db/db";

export const getOrgQuery = async ({
  orgSubdomain,
}: {
  orgSubdomain: string;
}) => {
  try {
    const org = await db
      .selectFrom("org")
      .where("org.subdomain", "=", orgSubdomain)
      .selectAll()
      .executeTakeFirst();

    return org;
  } catch (error: any) {
    throw error;
  }
};
