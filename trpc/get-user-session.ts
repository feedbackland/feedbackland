import "server-only";
import { publicProcedure } from "@/lib/trpc";
import z from "zod/v4";

export const getUserSession = publicProcedure
  .input(z.object({}))
  .query(({ ctx }) => ctx.session ?? null);
