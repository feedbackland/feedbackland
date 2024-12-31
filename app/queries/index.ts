import { db } from "@/app/db/db";

export const createOrg = async ({
  userEmail,
  orgName,
}: {
  userEmail: string;
  orgName: string;
}) => {
  return await db.transaction().execute(async (trx) => {
    const user = await trx
      .selectFrom("user")
      .select("id")
      .where("user.email", "=", userEmail.toLowerCase())
      .executeTakeFirstOrThrow();

    const org = await trx
      .insertInto("org")
      .values({
        name: orgName,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("user_org")
      .values({
        user_id: user.id,
        org_id: org.id,
        role: "admin",
      })
      .returningAll()
      .executeTakeFirst();
  });
};

export const getUserWithOrgAndRole = async ({ userId }: { userId: string }) => {
  const result = await db
    .selectFrom("user")
    .innerJoin("user_org", "user.id", "user_org.user_id")
    .innerJoin("org", "user_org.org_id", "org.id")
    .select([
      "user.id as user_id",
      "user.name as user_name",
      "org.id as org_id",
      "org.name as org_name",
      "user_org.role as user_org_role",
    ])
    .where("user.id", "=", userId)
    .execute();
  return result;
};
