import { adminAuth } from "@/lib/firebase/admin";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

async function getUserFromRequest(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  const token = authorization.split(" ")[1];
  if (!token) return null;
  const decodedIdToken = await adminAuth.verifyIdToken(token);
  if (!decodedIdToken) return null;
  return decodedIdToken;
}

export const createContext = async ({ req }: any) => {
  const user = await getUserFromRequest(req);
  return { user };
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

const isAuthed = t.middleware((opts) => {
  const { ctx } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in.",
    });
  }

  return opts.next({
    ctx: { user: ctx.user },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedUserProcedure = t.procedure.use(isAuthed);
