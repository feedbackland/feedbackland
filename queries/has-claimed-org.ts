"server-only";

import { db } from "@/db/db";

/**
 * True once any organization on this instance has been claimed. Used to make
 * self-hosted `/get-started` a one-time setup step rather than an open funnel.
 */
export async function hasClaimedOrgQuery() {
  const row = await db
    .selectFrom("org")
    .select("id")
    .where("isClaimed", "=", true)
    .limit(1)
    .executeTakeFirst();

  return !!row;
}
