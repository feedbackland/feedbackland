import { publicProcedure } from "@/lib/trpc";
import { polar } from "@/lib/polar";
import { z } from "zod";

export const getPolarProduct = publicProcedure
  .input(
    z.object({
      productId: z.string().min(1),
    }),
  )
  .query(async ({ input: { productId } }) => {
    try {
      const product = await polar.products.get({
        id: productId,
      });

      return product;
    } catch (error) {
      throw error;
    }
  });
