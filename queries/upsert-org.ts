"server-only";

import { db } from "@/db/db";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";

export const upsertOrgQuery = async ({ orgId }: { orgId: string }) => {
  try {
    console.log("upsertOrgQuery orgId", orgId);

    let org = await db
      .selectFrom("org")
      .selectAll()
      .where("id", "=", orgId)
      .executeTakeFirst();

    console.log("upsertOrgQuery org1", org);

    if (!org) {
      const orgSubdomain = uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: "-",
      });

      org = await db
        .insertInto("org")
        .values({
          id: orgId,
          subdomain: orgSubdomain,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      console.log("upsertOrgQuery org2", org);
    }

    console.log("upsertOrgQuery org3", org);

    return org || null;
  } catch (error: any) {
    throw error;
  }
};
