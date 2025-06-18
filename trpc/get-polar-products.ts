import { publicProcedure } from "@/lib/trpc";
import { polar } from "@/lib/polar";

export const getPolarProducts = publicProcedure.query(async ({}) => {
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
