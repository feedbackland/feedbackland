import { adminAuth } from "@/lib/firebase/admin";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getSubdomainFromUrl } from "@/lib/utils";
import { getOrgQuery } from "@/queries/get-org";

const getUser = async (req: Request) => {
  const authorization = req.headers.get("authorization");
  const idToken = authorization?.split(" ")?.[1];
  const user = idToken ? await adminAuth.verifyIdToken(idToken) : null;
  return user || null;
};

const getOrg = async (req: Request) => {
  const url = req.headers.get("referer");
  const subdomain = url ? getSubdomainFromUrl(url) : null;
  const org = subdomain ? await getOrgQuery({ orgSubdomain: subdomain }) : null;
  return org || null;
};

export const createContext = async ({ req }: { req: Request }) => {
  const user = await getUser(req);
  const org = await getOrg(req);
  return { user, org };
};

export type Context = typeof createContext;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

const publicProcedureMiddleware = t.middleware((opts) => {
  const { ctx } = opts;

  if (!ctx.org) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No organization was found",
    });
  }

  return opts.next(opts);
});

const userProcedureMiddleware = publicProcedureMiddleware.unstable_pipe(
  (opts) => {
    const { ctx } = opts;

    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in",
      });
    }

    return opts.next(opts);
  },
);

export const router = t.router;
export const publicProcedure = t.procedure.use(publicProcedureMiddleware);
export const userProcedure = t.procedure.use(userProcedureMiddleware);
