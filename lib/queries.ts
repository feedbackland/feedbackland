"server-only";

import { db } from "@/db/db";

export const getOrg = async ({ orgSubdomain }: { orgSubdomain: string }) => {
  return await db
    .selectFrom("org")
    .where("org.subdomain", "=", orgSubdomain)
    .select(["id", "name", "isClaimed"])
    .executeTakeFirst();
};
