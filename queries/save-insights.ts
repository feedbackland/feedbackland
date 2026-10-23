import "server-only";
import type { Insight } from "@/lib/typings";
export async function saveInsightsQuery(_input: {
  insights: Insight[];
}): Promise<never> {
  throw new Error("AI_NOT_CONFIGURED");
}
