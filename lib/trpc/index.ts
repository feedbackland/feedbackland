import { z } from "zod";
import { publicProcedure, router } from "./trpc";
import { getOrgQuery } from "@/queries/get-org";

export const appRouter = router({
  getOrg: publicProcedure
    .input(
      z.object({
        orgSubdomain: z.string().min(1),
      }),
    )
    .query(async (opts) => {
      return await getOrgQuery({ orgSubdomain: opts.input.orgSubdomain });
    }),
});

export type AppRouter = typeof appRouter;
