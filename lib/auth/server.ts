import "server-only";
import { betterAuth } from "better-auth";
import { getPool } from "../../db/db";
import { getConfig, neutraliseAuthEnv } from "../config";
import { runtimeState } from "../runtime-state";
import { isSetupComplete } from "../setup-state";
import { checkRateLimit } from "../../queries/check-rate-limit";
import { DomainError } from "../domain-error";
import { canAdministerSession, type SessionIdentity } from "./session-policy";
import { buildAuthOptions } from "./options";
import { reserveSignIn } from "./sign-in-limit";
import { sendResetPassword } from "../mail";
import { handoffStore } from "./handoff-store";
import type { OidcMetadata } from "./oidc";
import { authRateLimit } from "./rate-limit";
export function createAuthInstance(metadata?: OidcMetadata) {
  neutraliseAuthEnv();
  const config = getConfig();
  return betterAuth(
    buildAuthOptions({
      db: getPool(),
      secret: config.authSecret,
      appUrl: config.appUrl,
      socialProviders: config.appUrl?.startsWith("https:")
        ? {
            ...(config.social.google.clientId &&
            config.social.google.clientSecret
              ? {
                  google: {
                    clientId: config.social.google.clientId,
                    clientSecret: config.social.google.clientSecret,
                    overrideUserInfoOnSignIn: true,
                  },
                }
              : {}),
            ...(config.social.microsoft.clientId &&
            config.social.microsoft.clientSecret
              ? {
                  microsoft: {
                    clientId: config.social.microsoft.clientId,
                    clientSecret: config.social.microsoft.clientSecret,
                    tenantId: config.social.microsoft.tenantId,
                    overrideUserInfoOnSignIn: true,
                  },
                }
              : {}),
          }
        : {},
      oidc:
        metadata &&
        config.social.oidc.clientId &&
        config.social.oidc.clientSecret
          ? {
              metadata,
              clientId: config.social.oidc.clientId,
              clientSecret: config.social.oidc.clientSecret,
            }
          : undefined,
      handoff: config.appUrl?.startsWith("https:") ? handoffStore : undefined,
      clientIpHeader: config.clientIpHeader,
      trustedProxies: config.trustedProxies,
      authRateLimit,
      isSetupComplete,
      allowSignUp: async () =>
        (
          await checkRateLimit({
            key: "sign-up:instance",
            limit: 30,
            windowSeconds: 60,
          })
        ).allowed,
      reserveSignIn,
      sendResetPassword,
    }),
  );
}
export type Auth = ReturnType<typeof createAuthInstance>;
export function getAuth(): Auth {
  return (runtimeState().auth ??= createAuthInstance());
}
export async function getSocialAuth() {
  const { synchronizeAuthProviders } = await import("./discovery");
  await synchronizeAuthProviders(true);
  return getAuth();
}
export function requireAdminSession<T extends SessionIdentity>(
  session: T | null,
): T {
  if (!session) throw new DomainError("UNAUTHORIZED", "Sign in to continue");
  if (!canAdministerSession(session))
    throw new DomainError(
      "FORBIDDEN",
      "Sign in again with a first-party administrator session",
    );
  return session;
}
