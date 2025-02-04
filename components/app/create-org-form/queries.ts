"server-only";

import { db } from "@/db/db";

export const createOrg = async ({
  orgName,
  orgSubdomain,
}: {
  orgName: string;
  orgSubdomain: string;
}) => {
  try {
    const org = await db
      .insertInto("org")
      .values({
        name: orgName,
        subdomain: orgSubdomain,
      })
      .returning(["id", "name", "subdomain"])
      .executeTakeFirstOrThrow();

    return org;
  } catch (error: any) {
    if (error?.code === "23505") {
      throw new Error("duplicate subdomain");
    }

    throw error;
  }
};
