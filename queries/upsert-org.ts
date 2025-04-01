"server-only";

import { db } from "@/db/db";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";

export const upsertOrgQuery = async ({ orgId }: { orgId: string }) => {
  try {
    let org = await db
      .selectFrom("org")
      .selectAll()
      .where("id", "=", orgId)
      .executeTakeFirst();

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
    }

    console.log("upsertOrgQuery org", org);

    return org || null;
  } catch (error: any) {
    throw error;
  }
};
