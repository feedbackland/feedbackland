import "server-only";
import superjson from "superjson";
import { initTRPC, TRPCError } from "@trpc/server";
import z, { ZodError } from "zod/v4";
import { getClientIp } from "./client-ip";
import { DomainError } from "./domain-error";
export type RequestContext = {
  userId: string | null;
  userEmail: string | null;
  sessionId: string | null;
  canAdminister: boolean;
  ip: string;
};
export const createContext = async ({
  req,
}: {
  req: Request;
}): Promise<RequestContext> => ({
  userId: null,
  userEmail: null,
  sessionId: null,
  canAdminister: false,
  ip: getClientIp(req.headers),
});
const t = initTRPC.context<RequestContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
      },
    };
  },
});
export const router = t.router;
const mapDomainErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof DomainError) {
    const cause = result.error.cause;
    throw new TRPCError({ code: cause.code, message: cause.message, cause });
  }
  return result;
});
export const publicProcedure = t.procedure.use(mapDomainErrors);
export const userProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.userId)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign-in is unavailable until the authentication milestone",
    });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
export const adminProcedure = userProcedure.use(({ ctx, next }) => {
  if (!ctx.canAdminister || !ctx.sessionId)
    throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, sessionId: ctx.sessionId } });
});
