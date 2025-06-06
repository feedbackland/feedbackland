import { adminProcedure } from "@/lib/trpc";
import { polar } from "@/lib/polar";

export const getPolarProducts = adminProcedure.query(async ({}) => {
  try {
    const {
      result: { items },
    } = await polar.products.list({
      organizationId: process.env.POLAR_ORG_ID,
      isArchived: false,
      isRecurring: true,
    });

    return items;
  } catch (error) {
    throw error;
  }
});
