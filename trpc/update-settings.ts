import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { updateSettingsQuery } from "@/queries/update-settings";
export const updateSettings = adminProcedure
  .input(
    z.object({
      expectedRevision: z.string().regex(/^[1-9][0-9]*$/),
      platformTitle: z.string().trim().min(1).max(300).optional(),
      platformDescription: z.string().max(10000).nullable().optional(),
      allowIndexing: z.boolean().optional(),
    }),
  )
  .mutation(({ input, ctx }) =>
    updateSettingsQuery({
      ...input,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    }),
  );
