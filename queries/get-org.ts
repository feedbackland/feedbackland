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
      .where("org.orgSubdomain", "=", orgSubdomain)
      .selectAll()
      .executeTakeFirstOrThrow();

    return org;
  } catch (error) {
    throw error;
  }
};
