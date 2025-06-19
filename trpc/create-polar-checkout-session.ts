import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { polar } from "@/lib/polar";

export const createPolarCheckoutSession = adminProcedure
  .input(
    z.object({
      polarProductIds: z.array(z.string()),
    }),
  )
  .mutation(async ({ input: { polarProductIds }, ctx: { orgId } }) => {
    try {
      return await polar.checkouts.create({
        products: polarProductIds,
        externalCustomerId: orgId,
      });
    } catch (error) {
      throw error;
    }
  });
