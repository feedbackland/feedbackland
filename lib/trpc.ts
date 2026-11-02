import "server-only";
import { credentialHeaders } from "./auth/headers";
import superjson from "superjson";
import { initTRPC, TRPCError } from "@trpc/server";
import z, { ZodError } from "zod/v4";
import { getClientIp } from "./client-ip";
import { DomainError } from "./domain-error";
import { getAuth } from "./auth/server";
import { canAdministerSession } from "./auth/session-policy";
import { isSetupComplete } from "./setup-state";
export type RequestContext = {
  userId: string | null;
  userEmail: string | null;
  sessionId: string | null;
  canAdminister: boolean;
  ip: string;
  headers?: Headers;
  responseHeaders?: Headers;
  session?: Awaited<
    ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>
  >;
};
export const createContext = async ({
  req,
}: {
  req: Request;
}): Promise<RequestContext> => {
  const authHeaders = credentialHeaders(req.headers);
  const { response: session, headers } = await getAuth().api.getSession({
    headers: authHeaders,
    returnHeaders: true,
  });
  return {
    userId: session?.user.id ?? null,
    userEmail: session?.user.email ?? null,
    sessionId: session?.session.id ?? null,
    canAdminister: canAdministerSession(session),
    ip: getClientIp(req.headers),
    headers: authHeaders,
    responseHeaders: headers,
    session,
  };
};
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
export const publicProcedure = t.procedure
  .use(mapDomainErrors)
  .use(async ({ type, next }) => {
    if (type === "mutation" && !(await isSetupComplete()))
      throw new TRPCError({ code: "FORBIDDEN", message: "SETUP_REQUIRED" });
    return next();
  });
export const userProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.userId)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to continue",
    });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
export const adminProcedure = userProcedure.use(({ ctx, next }) => {
  if (!ctx.canAdminister || !ctx.sessionId)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Sign in again with a first-party administrator session",
    });
  return next({ ctx: { ...ctx, sessionId: ctx.sessionId } });
});
