import type { BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { popupHandoff } from "./popup-handoff";
type Dependencies = {
  db: NonNullable<BetterAuthOptions["database"]>;
  secret?: string;
  appUrl?: string;
  isSetupComplete?: () => Promise<boolean>;
  allowSignUp?: () => Promise<boolean>;
  allowSignIn?: (email: string) => Promise<boolean>;
  recordSignInFailure?: (email: string) => Promise<void>;
  clientIpHeader?: string;
  trustedProxies?: string[];
  sendResetPassword?: NonNullable<
    BetterAuthOptions["emailAndPassword"]
  >["sendResetPassword"];
};
function authName(name: string) {
  const value = name.trim().slice(0, 100);
  if (!value)
    throw new APIError("BAD_REQUEST", { message: "Name is required" });
  return value;
}
function providerImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
/** Pure options: all server collaborators are injected, including DDL stubs. */
export function buildAuthOptions(deps: Dependencies) {
  return {
    database: deps.db,
    secret: deps.secret,
    baseURL: deps.appUrl,
    telemetry: { enabled: false },
    logger: { disabled: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          ctx.request &&
          ctx.path !== "/get-session" &&
          !(await deps.isSetupComplete?.())
        )
          throw new APIError("FORBIDDEN", {
            code: "SETUP_REQUIRED",
            message: "Complete setup first",
          });
        if (ctx.body && typeof ctx.body === "object") {
          for (const field of ["password", "newPassword", "currentPassword"]) {
            if (typeof ctx.body[field] === "string") {
              ctx.body[field] = ctx.body[field].trim();
              if (ctx.body[field].length < 8 || ctx.body[field].length > 128)
                throw new APIError("BAD_REQUEST", {
                  code: "INVALID_PASSWORD",
                  message: "Password must contain 8–128 characters",
                });
            }
          }
        }
        if (
          ctx.path === "/sign-up/email" &&
          deps.allowSignUp &&
          !(await deps.allowSignUp())
        )
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many attempts. Try again later.",
          });
        if (
          ctx.path === "/sign-in/email" &&
          typeof ctx.body?.email === "string" &&
          deps.allowSignIn &&
          !(await deps.allowSignIn(ctx.body.email))
        )
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many attempts. Try again later.",
          });
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path === "/sign-in/email" &&
          typeof ctx.body?.email === "string" &&
          ctx.context.returned instanceof APIError &&
          ctx.context.returned.statusCode === 401
        )
          await deps.recordSignInFailure?.(ctx.body.email);
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => ({
            data: {
              ...user,
              role: "user",
              name: authName(user.name),
              image:
                ctx?.path?.startsWith("/callback/") && providerImage(user.image)
                  ? user.image
                  : null,
            },
          }),
        },
        update: {
          before: async (user, ctx) => {
            const provider = ctx?.path?.startsWith("/callback/");
            if (user.image !== undefined && !provider)
              throw new APIError("BAD_REQUEST", {
                code: "FIELD_NOT_ALLOWED",
                message: "Only a sign-in provider may update the avatar",
              });
            const data = { ...user };
            if (typeof data.name === "string") data.name = authName(data.name);
            if (
              data.image === undefined ||
              (provider && !providerImage(data.image))
            )
              delete data.image;
            return { data };
          },
        },
      },
      session: {
        create: {
          before: async (_session, ctx) => {
            const existing = ctx?.context.session?.session as
              { scope?: string } | undefined;
            if (
              ctx?.headers?.get("x-feedbackland-scope") === "embedded" ||
              existing?.scope === "embedded"
            )
              return { data: { scope: "embedded" } };
          },
        },
        update: {
          before: async (session) => {
            if (session.scope !== undefined)
              throw new APIError("BAD_REQUEST", {
                code: "FIELD_NOT_ALLOWED",
                message: "Session scope is immutable",
              });
          },
        },
      },
    },
    user: {
      deleteUser: { enabled: false },
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "user",
          input: false,
        },
      },
    },
    session: {
      modelName: "auth_session",
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      additionalFields: {
        scope: {
          type: "string",
          required: false,
          defaultValue: "first-party",
          input: false,
        },
      },
    },
    account: { modelName: "auth_account", accountLinking: { enabled: false } },
    verification: { modelName: "auth_verification" },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "auth_rate_limit",
      customRules: {
        "/sign-in/email": { window: 900, max: 10 },
        "/sign-up/email": { window: 60, max: 30 },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: deps.sendResetPassword,
    },
    advanced: {
      disableOriginCheck: false,
      trustedProxyHeaders: !deps.appUrl,
      useSecureCookies: deps.appUrl?.startsWith("https:") ?? false,
      database: { joins: true },
      ipAddress: {
        ipAddressHeaders: [deps.clientIpHeader ?? "x-forwarded-for"],
        trustedProxies: deps.trustedProxies ?? [],
      },
    },
    plugins: [
      bearer({ requireSignature: true }),
      popupHandoff(),
      nextCookies(),
    ],
  } satisfies BetterAuthOptions;
}
