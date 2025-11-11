"server-only";

import { db } from "@/db/db";
import { v4 as uuidv4 } from "uuid";

function getPlatformTitle(productName: string): string {
  // Ensure the product name isn't empty
  if (!productName) {
    return "Feedback board";
  }

  // Check the last character to form the possessive correctly
  const possessiveName = productName.endsWith("s")
    ? `${productName}'`
    : `${productName}'s`;

  return `${possessiveName} feedback board`;
}

export const createOrgQuery = async ({
  orgName,
  orgSubdomain,
}: {
  orgName: string;
  orgSubdomain: string;
}) => {
  try {
    return await db.transaction().execute(async (trx) => {
      const org = await trx
        .insertInto("org")
        .values({
          id: uuidv4(),
          orgName: orgName && orgName?.length > 0 ? orgName : null,
          orgSubdomain,
          platformTitle: getPlatformTitle(orgName),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("feedback")
        .values([
          {
            title: "Example post - Add a dark mode option",
            description:
              "I often use the platform late at night, and the bright white interface can be quite harsh on the eyes in a dark room. So having the option to toggle on a dark mode would be great!",
            category: "idea",
            authorId: null,
            orgId: org.id,
            embedding: null,
          },
          {
            title: "Example post - Make search more powerful",
            description:
              "It would be great if the search could find relevant results even if I don't type the exact word, like finding synonyms.",
            category: "general feedback",
            authorId: null,
            orgId: org.id,
            embedding: null,
          },
          {
            title: "Example post - The dashboard loads very slowly",
            description: `The dashboard's performance is very poor, often leading to slow loads or complete timeouts.`,
            category: "issue",
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
