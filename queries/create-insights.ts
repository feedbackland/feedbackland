"server-only";

import { db } from "@/db/db";
import type { Insertable } from "kysely";
import type { DB } from "@/db/schema";

type InsightInput = Omit<
  Insertable<DB["insights"]>,
  "id" | "createdAt" | "updatedAt"
>;

export const createInsightsQuery = async (insightsToCreate: InsightInput[]) => {
  const orgId = insightsToCreate[0].orgId;

  try {
    return await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("insights")
        .where("insights.orgId", "=", orgId)
        .execute();

      if (insightsToCreate?.length > 0) {
        await trx.insertInto("insights").values(insightsToCreate).execute();

        await trx
          .insertInto("insight_reports")
          .values({
            orgId,
          })
          .execute();
      }

      return true;
    });
  } catch (error: any) {
    throw error;
  }
};
