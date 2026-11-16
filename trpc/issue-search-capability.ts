import "server-only";
import { z } from "zod/v4";
import { sql } from "kysely";
import { publicProcedure } from "@/lib/trpc";
import { contentTransaction } from "@/db/content-transaction";
import {
  issueSearchCapability,
  searchLifetimeMs,
} from "@/lib/search/capability";

export const issueSearchTicket = publicProcedure
  .input(z.object({ nonce: z.string().regex(/^[0-9a-f]{64}$/) }))
  .mutation(({ input, ctx }) =>
    contentTransaction(ctx.signal, async (trx) => {
      const {
        rows: [clock],
      } = await sql<{ now: Date }>`select clock_timestamp() as now`.execute(
        trx,
      );
      return issueSearchCapability(
        input.nonce,
        clock.now.getTime() + searchLifetimeMs,
      );
    }),
  );
