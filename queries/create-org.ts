"server-only";

import { db } from "@/db/db";
import { v4 as uuidv4 } from "uuid";
import {
  uniqueNamesGenerator,
  colors,
  animals,
  NumberDictionary,
} from "unique-names-generator";

type args =
  | {
      orgId?: string;
      orgSubdomain?: string;
    }
  | undefined;

export const createOrgQuery = async (args?: args) => {
  try {
    return await db.transaction().execute(async (trx) => {
      const id = args?.orgId || uuidv4();
      const orgSubdomain =
        args?.orgSubdomain ||
        uniqueNamesGenerator({
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

      const org = await trx
        .insertInto("org")
        .values({
          id,
          orgSubdomain,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("feedback")
        .values([
          {
            title: "Example post - Add a dark mode to the IU",
            description:
              "I often use the platform late at night, and the bright white interface can be quite harsh on the eyes in a dark room. So having the option to toggle on a dark mode would be great!",
            category: "feature request",
            authorId: null,
            orgId: org.id,
            embedding: null,
          },
          {
            title: "Example post - Make search more powerful",
            description:
              "It would be a huge improvement if the search could also index and find keywords within the description of the feedback posts.",
            category: "general feedback",
            authorId: null,
            orgId: org.id,
            embedding: null,
          },
        ])
        .execute();

      return org;
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      throw new Error("duplicate subdomain");
    }

    throw error;
  }
};
