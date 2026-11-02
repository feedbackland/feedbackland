import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "../lib/trpc";
import { createPasswordResetLinkQuery } from "../queries/create-password-reset-link";

export const createPasswordResetLink = adminProcedure
  .input(
    z
      .object({ email: z.string().trim().toLowerCase().pipe(z.email()) })
      .strict(),
  )
  .mutation(({ input, ctx }) =>
    createPasswordResetLinkQuery(
      { userId: ctx.userId, sessionId: ctx.sessionId },
      input.email,
      ctx.headers!,
    ),
  );
