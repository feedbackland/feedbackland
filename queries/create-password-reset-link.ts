import "server-only";
import { db } from "../db/db";
import { lock, locks } from "../db/locks";
import { getAuth } from "../lib/auth/server";
import { requireAdmin, type Actor } from "../lib/auth/authorization";
import { captureResetToken } from "../lib/mail";
import { getAppUrl } from "../lib/app-url";
import { DomainError } from "../lib/domain-error";
import { log, sqlstate } from "../lib/log";

export async function createPasswordResetLinkQuery(
  actor: Actor,
  email: string,
  headers: Headers,
) {
  const target = await db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, actor);
    const user = await trx
      .selectFrom("user")
      .select(["id", "role"])
      .where("email", "=", email.trim().toLowerCase())
      .forUpdate()
      .executeTakeFirst();
    if (!user || user.role === "admin")
      throw new DomainError(
        "FORBIDDEN",
        "Reset links are available only for non-admin password accounts",
      );
    const account = await trx
      .selectFrom("auth_account")
      .select("id")
      .where("userId", "=", user.id)
      .where("providerId", "=", "credential")
      .where("password", "is not", null)
      .executeTakeFirst();
    if (!account)
      throw new DomainError(
        "FORBIDDEN",
        "Reset links are available only for non-admin password accounts",
      );
    return user.id;
  });
  let token: string | undefined;
  try {
    // No membership transaction/connection is held across the Auth call.
    token = await captureResetToken(target, () =>
      getAuth().api.requestPasswordReset({
        headers,
        body: {
          email: email.trim().toLowerCase(),
          redirectTo: "/reset-password",
        },
      }),
    );
    await db.transaction().execute(async (trx) => {
      await lock(trx, locks.membership);
      await requireAdmin(trx, actor);
      const user = await trx
        .selectFrom("user")
        .select("role")
        .where("id", "=", target)
        .forUpdate()
        .executeTakeFirst();
      if (!user || user.role === "admin")
        throw new DomainError(
          "FORBIDDEN",
          "Reset links are available only for non-admin password accounts",
        );
    });
    const link = new URL("/reset-password", getAppUrl(headers).appUrl);
    link.searchParams.set("token", token);
    log("auth.admin-reset-issued", {
      actor: actor.userId,
      target,
      time: new Date().toISOString(),
    });
    return { url: link.href };
  } catch (error) {
    if (token) {
      try {
        await db
          .deleteFrom("auth_verification")
          .where("identifier", "=", `reset-password:${token}`)
          .execute();
      } catch (cleanup) {
        log(
          "auth.reset-cleanup-failed",
          { sqlstate: sqlstate(cleanup) },
          "warn",
        );
      }
    }
    throw error;
  }
}
