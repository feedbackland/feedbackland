import type { BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
type Dependencies = {
  db: NonNullable<BetterAuthOptions["database"]>;
  secret?: string;
  appUrl?: string;
  sendResetPassword?: NonNullable<
    BetterAuthOptions["emailAndPassword"]
  >["sendResetPassword"];
};
/** Pure definition, without a database/secret of its own. P04 supplies hooks. */
export function buildAuthOptions(deps: Dependencies): BetterAuthOptions {
  return {
    database: deps.db,
    secret: deps.secret,
    baseURL: deps.appUrl,
    telemetry: { enabled: false },
    user: {
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
    },
    plugins: [bearer({ requireSignature: true }), nextCookies()],
  };
}
