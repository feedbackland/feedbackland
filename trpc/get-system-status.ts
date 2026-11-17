import "server-only";
import { adminProcedure } from "@/lib/trpc";
import { systemStatus } from "@/lib/request-diagnostics";
export const getSystemStatus = adminProcedure.query(({ ctx }) =>
  systemStatus(ctx.headers ?? new Headers()),
);
