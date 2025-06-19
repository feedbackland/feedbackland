import { db } from "@/db/db";

export const getInsightReportCountQuery = async ({
  orgId,
}: {
  orgId: string;
}) => {
  try {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const result = await db
      .selectFrom("insight_reports")
      .select(db.fn.count("id").as("count"))
      .where("orgId", "=", orgId)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  } catch (error) {
    throw error;
  }
};
