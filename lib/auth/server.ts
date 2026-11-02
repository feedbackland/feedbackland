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
function createAuth() {
  neutraliseAuthEnv();
  const config = getConfig();
  return betterAuth(
    buildAuthOptions({
      db: getPool(),
      secret: config.authSecret,
      appUrl: config.appUrl,
      clientIpHeader: config.clientIpHeader,
      trustedProxies: config.trustedProxies,
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
    }),
  );
}
export type Auth = ReturnType<typeof createAuth>;
export function getAuth(): Auth {
  return (runtimeState().auth ??= createAuth());
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
