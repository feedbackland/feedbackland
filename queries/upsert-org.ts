"server-only";

import { db } from "@/db/db";
import { v4 as uuidv4 } from "uuid";
import {
  uniqueNamesGenerator,
  colors,
  animals,
  NumberDictionary,
} from "unique-names-generator";

export const upsertOrgQuery = async ({ orgId }: { orgId: string }) => {
  try {
    return await db.transaction().execute(async (trx) => {
      let subdomain: string | undefined;

      const org = await trx
        .selectFrom("org")
        .select(["orgSubdomain"])
        .where("id", "=", orgId)
        .executeTakeFirst();

      subdomain = org?.orgSubdomain;

      if (!org) {
        const id = uuidv4();

        const orgSubdomain = uniqueNamesGenerator({
          dictionaries: [
            colors,
            animals,
            NumberDictionary.generate({
              min: 100,
              max: 999,
            }),
          ],
          length: 3,
          separator: "-",
        });

        const newOrg = await trx
          .insertInto("org")
          .values({
            id,
            orgSubdomain,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        subdomain = newOrg.orgSubdomain;

        await trx
          .insertInto("feedback")
          .values({
            title: "An example feedback post",
            description:
              "Just an example of a feedback post. Feel free to delete it.",
            category: "general feedback",
            authorId: null,
            orgId: newOrg.id,
            embedding: null,
          })
          .execute();
      }

      if (subdomain) {
        return subdomain;
      } else {
        throw new Error("No subdomain found");
      }
    });
  } catch (error) {
    throw error;
  }
};
