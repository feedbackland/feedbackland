import { db } from "@/app/db/db";

export const createOrg = async ({
  userId,
  orgName,
  orgSubdomain,
}: {
  userId: string;
  orgName: string;
  orgSubdomain: string;
}) => {
  try {
    const result = await db.transaction().execute(async (trx) => {
      const org = await trx
        .insertInto("org")
        .values({
          name: orgName,
          subdomain: orgSubdomain,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("user_org")
        .values({
          user_id: userId,
          org_id: org.id,
          role: "admin",
        })
        .returningAll()
        .executeTakeFirst();
    });
    return result;
  } catch (error) {
    throw error;
  }
};

export const getOrg = async ({ subdomain }: { subdomain: string }) => {
  try {
    const result = await db
      .selectFrom("org")
      .where("org.subdomain", "=", subdomain)
      .select(["org.id", "org.name", "org.subdomain"])
      .executeTakeFirst();
    return result;
  } catch (error) {
    throw error;
  }
};

export const isOrgNameAvailable = async ({ orgName }: { orgName: string }) => {
  try {
    const isAvailable = !(await db
      .selectFrom("org")
      .where("name", "=", orgName)
      .select("id")
      .executeTakeFirst());
    return isAvailable;
  } catch (error) {
    throw error;
  }
};

export const isOrgSubdomainAvailable = async ({
  orgSubdomain,
}: {
  orgSubdomain: string;
}) => {
  try {
    const isAvailable = !(await db
      .selectFrom("org")
      .where("subdomain", "=", orgSubdomain)
      .select("id")
      .executeTakeFirst());
    return isAvailable;
  } catch (error) {
    throw error;
  }
};
