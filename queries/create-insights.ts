"server-only";

import { db } from "@/db/db";
import type { Insertable } from "kysely";
import type { DB } from "@/db/schema";

type InsightInput = Omit<
  Insertable<DB["insights"]>,
  "id" | "createdAt" | "updatedAt"
>;

export const createInsightsQuery = async ({
  orgId,
  insights,
}: {
  orgId: string;
  insights: InsightInput[];
}) => {
  return await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("insights")
      .where("insights.orgId", "=", orgId)
      .execute();

    if (insights.length > 0) {
      await trx.insertInto("insights").values(insights).execute();

      await trx
        .insertInto("insight_reports")
        .values({ orgId })
        .execute();
    }

    return true;
  });
};
