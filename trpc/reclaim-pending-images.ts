import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { managePendingImages } from "@/lib/images/store";
export const getImageUsage = adminProcedure.query(({ ctx }) =>
  managePendingImages(ctx, false),
);
export const reclaimPendingImages = adminProcedure
  .input(z.object({ confirm: z.literal(true) }))
  .mutation(({ ctx }) => managePendingImages(ctx, true));
