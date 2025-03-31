"server-only";

import { db } from "@/db/db";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";

export const upsertOrgQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const orgSubdomain = uniqueNamesGenerator({
      dictionaries: [adjectives, animals],
      separator: "-",
    });

    const org = await db
      .insertInto("org")
      .values({
        id: orgId,
        subdomain: orgSubdomain,
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .returningAll()
      .executeTakeFirstOrThrow();

    return org;
  } catch (error: any) {
    throw error;
  }
};
