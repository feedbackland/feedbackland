import { db } from "@/app/db/db";

export const createOrg = async ({ name }: { name: string }) => {
  return await db
    .insertInto("org")
    .values({
      name,
    })
    .returning("id")
    .execute();
};
