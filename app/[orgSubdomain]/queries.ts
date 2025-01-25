import { db } from "@/db/db";

export const getOrg = async ({ orgSubdomain }: { orgSubdomain: string }) => {
  return await db
    .selectFrom("org")
    .where("org.subdomain", "=", orgSubdomain)
    .select(["id", "name", "is_claimed"])
    .executeTakeFirst();
};

// export const getOrgWithUsers = async ({
//   orgSubdomain,
// }: {
//   orgSubdomain: string;
// }) => {
//   const result = await db
//     .selectFrom("org")
//     .leftJoin("user_org", "user_org.org_id", "org.id")
//     .leftJoin("user", "user.id", "user_org.user_id")
//     .select([
//       "org.id as orgId",
//       "org.name as orgName",
//       "user.id as userId",
//       "user.name as username",
//     ])
//     .where("org.subdomain", "=", orgSubdomain)
//     .execute();

//   return result;
// };

// export const isOrgClaimed = async ({ orgId }: { orgId: string }) => {
//   const result = await db
//     .selectFrom("user_org")
//     .selectAll()
//     .where("user_org.org_id", "=", orgId)
//     .executeTakeFirst();

//   return result !== undefined;
// };
