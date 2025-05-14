import superjson from "superjson";
import { adminAuth } from "@/lib/firebase/admin";
import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { getUserWithRoleAndOrgQuery } from "@/queries/get-user-with-role-and-org";
import { getOrgQuery } from "@/queries/get-org";
import { UserRole } from "@/lib/typings";

const getUserID = async (req: Request) => {
  const authorization = req.headers.get("authorization");
  const idToken = authorization?.split(" ")?.[1];
  const user = idToken ? await adminAuth.verifyIdToken(idToken) : null;
  return user?.uid || null;
};

export const createContext = async ({ req }: { req: Request }) => {
  const orgSubdomain = req?.headers?.get("subdomain");
  const userId = await getUserID(req);
  let orgId: string | null | undefined;
  let orgName: string | null | undefined;
  let orgIsClaimed: boolean | null | undefined;
  let userRole: UserRole | null | undefined;

  if (orgSubdomain) {
    // not signed in
    if (!userId) {
      const org = await getOrgQuery({ orgSubdomain });
      orgId = org?.id;
      orgIsClaimed = org?.isClaimed;
      orgName = org?.orgName;
    }
    // signed in
    else {
      const userWithRoleAndOrg = await getUserWithRoleAndOrgQuery({
        userId,
        orgSubdomain,
      });

      orgId = userWithRoleAndOrg?.orgId;
      orgIsClaimed = userWithRoleAndOrg?.orgIsClaimed;
      orgName = userWithRoleAndOrg?.orgName;
      userRole = userWithRoleAndOrg?.userRole;
    }
  }

  return {
    orgId,
    orgName,
    orgSubdomain,
    orgIsClaimed,
    userId,
    userRole,
  };
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

  if (!ctx?.orgId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No orgId was found",
    });
  }

  return opts.next({
    ...opts,
    ctx: {
      ...ctx,
      orgId: ctx.orgId,
    },
  });
});

const userProcedureMiddleware = publicProcedureMiddleware.unstable_pipe(
  (opts) => {
    const { ctx } = opts;

    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "No userId was found",
      });
    }

    return opts.next({
      ...opts,
      ctx: {
        ...ctx,
        userId: ctx.userId,
      },
    });
  },
);

const adminProcedureMiddleware = userProcedureMiddleware.unstable_pipe(
  (opts) => {
    const { ctx } = opts;

    if (ctx.userRole !== "admin") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User does not have admin role",
      });
    }

    return opts.next({
      ...opts,
      ctx: {
        ...ctx,
        userRole: ctx.userRole,
      },
    });
  },
);

export const router = t.router;
export const publicProcedure = t.procedure.use(publicProcedureMiddleware);
export const userProcedure = t.procedure.use(userProcedureMiddleware);
export const adminProcedure = t.procedure.use(adminProcedureMiddleware);
