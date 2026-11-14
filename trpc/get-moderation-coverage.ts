import "server-only";
import { adminProcedure } from "@/lib/trpc";
import { getModerationCoverageQuery } from "@/queries/get-moderation-coverage";
export const getModerationCoverage = adminProcedure.query(() =>
  getModerationCoverageQuery(),
);
