"server-only";

import { db } from "@/db/db";
import {
  uniqueNamesGenerator,
  colors,
  animals,
  NumberDictionary,
} from "unique-names-generator";

export const upsertOrgQuery = async ({ orgId }: { orgId: string }) => {
  try {
    return await db.transaction().execute(async (trx) => {
      let org = await trx
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
          dictionaries: [colors, animals, numberDictionary],
          length: 3,
          separator: "-",
        });

        org = await trx
          .insertInto("org")
          .values({
            id: orgId,
            orgSubdomain,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      return org;
    });
  } catch (error: any) {
    throw error;
  }
};
