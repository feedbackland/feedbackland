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

    return await db
      .insertInto("org")
      .values({
        id,
        orgSubdomain,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch (error: any) {
    if (error?.code === "23505") {
      throw new Error("duplicate subdomain");
    }

    throw error;
  }
};
