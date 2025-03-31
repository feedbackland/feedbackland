"server-only";

import { db } from "@/db/db";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";

export const upsertOrgQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const existingOrg = await db
      .selectFrom("org")
      .selectAll()
      .where("id", "=", orgId)
      .executeTakeFirst();

    if (existingOrg) {
      return existingOrg;
    }

    const orgSubdomain = uniqueNamesGenerator({
      dictionaries: [adjectives, animals],
      separator: "-",
    });

    const newOrg = await db
      .insertInto("org")
      .values({
        id: orgId,
        subdomain: orgSubdomain,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return newOrg;
  } catch (error: any) {
    throw error;
  }
};
