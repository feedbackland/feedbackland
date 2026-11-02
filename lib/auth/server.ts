import "server-only";
import { betterAuth } from "better-auth";
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { db, getPool } from "../../db/db";
import { getConfig, neutraliseAuthEnv } from "../config";
import { runtimeState } from "../runtime-state";
import { isSetupComplete } from "../setup-state";
import { checkRateLimit } from "../../queries/check-rate-limit";
import { log, sqlstate } from "../log";
import { DomainError } from "../domain-error";
import { canAdministerSession, type SessionIdentity } from "./session-policy";
import { buildAuthOptions } from "./options";

const emailKey = (email: string) =>
  `sign-in:email:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
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
      allowSignIn: async (email) => {
        try {
          const row = await db
            .selectFrom("rate_limit")
            .select("count")
            .where("key", "=", emailKey(email))
            .where(
              "windowStart",
              ">",
              sql<Date>`clock_timestamp()-interval '15 minutes'`,
            )
            .executeTakeFirst();
          return !row || row.count < 10;
        } catch (error) {
          log(
            "auth.email-limit-unavailable",
            { sqlstate: sqlstate(error) },
            "warn",
          );
          return true;
        }
      },
      recordSignInFailure: async (email) => {
        await checkRateLimit({
          key: emailKey(email),
          limit: 10,
          windowSeconds: 900,
        });
      },
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
