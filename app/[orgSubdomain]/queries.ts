import { db } from "@/db/db";

export const getOrg = async ({ orgSubdomain }: { orgSubdomain: string }) => {
  return await db
    .selectFrom("org")
    .where("org.subdomain", "=", orgSubdomain)
    .select(["id", "name"])
    .executeTakeFirst();
};

export const isOrgClaimed = async ({ orgId }: { orgId: string }) => {
  const result = await db
    .selectFrom("user_org")
    .selectAll()
    .where("user_org.org_id", "=", orgId)
    .executeTakeFirst();

  return result !== undefined;
};
