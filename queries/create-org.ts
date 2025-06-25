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

      await db
        .insertInto("feedback")
        .values({
          title: "An example feedback post",
          description:
            "Just an example of a feedback post. Feel free to delete it.",
          category: "general feedback",
          authorId: null,
          orgId: org.id,
          embedding: null,
        })
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
