import "server-only";
import type { AuthContext, BetterAuthPlugin } from "better-auth";
import {
  APIError,
  changePassword,
  createAuthEndpoint,
  createAuthMiddleware,
  resetPassword,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { parseUserOutput } from "better-auth/db";
import { sql } from "kysely";
import { db } from "../../db/db";
import { lock, locks } from "../../db/locks";
import { resetIssuer } from "../mail";
import { requireAdmin } from "./authorization";
import {
  credentialAccount,
  lockCredentialUser,
  revokeResetLinks,
  withCredentialAdapter,
} from "./credentials";

const invalidGrant = () =>
  new APIError("BAD_REQUEST", {
    code: "INVALID_TOKEN",
    message: "Invalid token",
  });
const invalidPassword = () =>
  new APIError("BAD_REQUEST", {
    code: "INVALID_PASSWORD",
    message: "Invalid password",
  });

// dispatchAuthEndpoint supplies a separate AuthContext for every request. Keep
// the SDK's sign-in checks, rate admission and cookie/bearer handling, and carry
// its successful proof through to the transaction that inserts the session.
function fencePasswordSignIn(context: AuthContext) {
  const password = context.password;
  const adapter = context.internalAdapter;
  let verifiedHash: string | undefined;
  context.password = {
    ...password,
    async verify(input) {
      const valid = await password.verify(input);
      verifiedHash = valid ? input.hash : undefined;
      return valid;
    },
  };
  context.internalAdapter = {
    ...adapter,
    createSession: (...args) =>
      db.transaction().execute(async (trx) => {
        const userId = args[0];
        await lockCredentialUser(trx, userId);
        const account = await credentialAccount(trx, userId)
          .forUpdate()
          .executeTakeFirst();
        if (!verifiedHash || account?.password !== verifiedHash)
          throw new APIError("UNAUTHORIZED", {
            code: "INVALID_EMAIL_OR_PASSWORD",
            message: "Invalid email or password",
          });
        return withCredentialAdapter(trx, context, () =>
          adapter.createSession(...args),
        );
      }),
  };
}

function fenceResetIssuance(context: AuthContext) {
  const adapter = context.internalAdapter;
  context.internalAdapter = {
    ...adapter,
    createVerificationValue: (data) =>
      db.transaction().execute(async (trx) => {
        const issuer = resetIssuer(data.value);
        if (issuer) {
          await lock(trx, locks.membership);
          await requireAdmin(trx, issuer);
        }
        const target = await lockCredentialUser(trx, data.value);
        if (!target) throw invalidGrant();
        if (
          issuer &&
          (target.role === "admin" ||
            !(await credentialAccount(trx, target.id).executeTakeFirst())
              ?.password)
        )
          throw new APIError("FORBIDDEN", {
            message:
              "Reset links are available only for non-admin password accounts",
          });
        const grant = await withCredentialAdapter(trx, context, () =>
          adapter.createVerificationValue(data),
        );
        // Self-issued means delivery to the account's email. An administrator
        // can issue only for someone else. An unmarked legacy grant has neither authority.
        await trx
          .updateTable("auth_verification")
          .set({ resetIssuerId: issuer?.userId ?? target.id })
          .where("id", "=", grant.id)
          .returning("id")
          .executeTakeFirstOrThrow();
        return grant;
      }),
  };
}

export function passwordEndpoints() {
  return {
    id: "feedbackland-passwords",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) =>
            fencePasswordSignIn(ctx.context),
          ),
        },
        {
          matcher: (ctx) => ctx.path === "/request-password-reset",
          handler: createAuthMiddleware(async (ctx) =>
            fenceResetIssuance(ctx.context),
          ),
        },
      ],
    },
    endpoints: {
      resetPassword: createAuthEndpoint(
        resetPassword.path,
        resetPassword.options,
        async (ctx) => {
          const token = ctx.body.token || ctx.query?.token;
          if (!token) throw invalidGrant();
          const identifier = `reset-password:${token}`;
          const findGrant = (database: typeof db) =>
            database
              .selectFrom("auth_verification")
              .select(["id", "value", "resetIssuerId"])
              .where("identifier", "=", identifier)
              .where("resetIssuerId", "is not", null)
              .where("expiresAt", ">", sql<Date>`clock_timestamp()`);
          const snapshot = await findGrant(db).executeTakeFirst();
          if (!snapshot) throw invalidGrant();
          const hash = await ctx.context.password.hash(ctx.body.newPassword);
          await db.transaction().execute(async (trx) => {
            const administratorIssued =
              snapshot.resetIssuerId !== snapshot.value;
            if (administratorIssued) await lock(trx, locks.membership);
            const user = await lockCredentialUser(trx, snapshot.value);
            const grant = await findGrant(trx)
              .where("id", "=", snapshot.id)
              .forUpdate()
              .executeTakeFirst();
            if (
              !user ||
              !grant ||
              grant.value !== user.id ||
              grant.resetIssuerId !== snapshot.resetIssuerId
            )
              throw invalidGrant();
            const account = await credentialAccount(trx, user.id)
              .forUpdate()
              .executeTakeFirst();
            if (administratorIssued && grant.resetIssuerId) {
              const issuer = await trx
                .selectFrom("user")
                .select("role")
                .where("id", "=", grant.resetIssuerId)
                .executeTakeFirst();
              if (
                user.role === "admin" ||
                issuer?.role !== "admin" ||
                !account?.password
              )
                throw invalidGrant();
            }
            const adapter = ctx.context.internalAdapter;
            await withCredentialAdapter(trx, ctx.context, async () => {
              if (account) await adapter.updatePassword(user.id, hash);
              else
                await adapter.createAccount({
                  userId: user.id,
                  accountId: user.id,
                  providerId: "credential",
                  password: hash,
                });
              await adapter.deleteUserSessions(user.id);
            });
            await revokeResetLinks(trx, user.id);
          });
          return ctx.json({ status: true });
        },
      ),
      changePassword: createAuthEndpoint(
        changePassword.path,
        changePassword.options,
        async (ctx) => {
          const { user, session } = ctx.context.session;
          const { currentPassword, newPassword, revokeOtherSessions } =
            ctx.body;
          const adapter = ctx.context.internalAdapter;
          const snapshot = await adapter.findCredentialAccount(user.id);
          if (
            !snapshot?.password ||
            !(await ctx.context.password.verify({
              hash: snapshot.password,
              password: currentPassword,
            }))
          )
            throw invalidPassword();
          const hash = await ctx.context.password.hash(newPassword);
          const replacement = await db.transaction().execute(async (trx) => {
            await lockCredentialUser(trx, user.id);
            const account = await credentialAccount(trx, user.id)
              .forUpdate()
              .executeTakeFirst();
            if (
              !account ||
              account.id !== snapshot.id ||
              account.password !== snapshot.password
            )
              throw invalidPassword();
            const live = await trx
              .selectFrom("auth_session")
              .select("id")
              .where("id", "=", session.id)
              .where("userId", "=", user.id)
              .where("expiresAt", ">", sql<Date>`clock_timestamp()`)
              .forUpdate()
              .executeTakeFirst();
            if (!live) throw new APIError("UNAUTHORIZED");
            await revokeResetLinks(trx, user.id);
            return withCredentialAdapter(trx, ctx.context, async () => {
              await adapter.updatePassword(user.id, hash);
              if (!revokeOtherSessions) return null;
              await adapter.deleteUserSessions(user.id);
              return adapter.createSession(user.id);
            });
          });
          if (replacement)
            await setSessionCookie(ctx, { user, session: replacement });
          return ctx.json({
            token: replacement?.token ?? null,
            user: parseUserOutput(ctx.context.options, user),
          });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
