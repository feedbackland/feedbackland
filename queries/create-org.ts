"server-only";

import { db } from "@/db/db";

export const createOrgQuery = async ({
  orgName,
  orgSubdomain,
}: {
  orgName: string;
  orgSubdomain: string;
}) => {
  try {
    return await db
      .insertInto("org")
      .values({
        orgName,
        orgSubdomain,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch (error: any) {
    if (error?.code === "23505") {
      throw new Error("duplicate subdomain");
    }

    throw error;
  }
};
