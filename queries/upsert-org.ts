"server-only";

import { db } from "@/db/db";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
  NumberDictionary,
} from "unique-names-generator";

export const upsertOrgQuery = async ({ orgId }: { orgId: string }) => {
  try {
    let org = await db
      .selectFrom("org")
      .selectAll()
      .where("id", "=", orgId)
      .executeTakeFirst();

    if (!org) {
      const numberDictionary = NumberDictionary.generate({
        min: 100,
        max: 999,
      });
      const orgSubdomain = uniqueNamesGenerator({
        dictionaries: [adjectives, animals, numberDictionary],
        length: 3,
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

    return org || null;
  } catch (error: any) {
    throw error;
  }
};
