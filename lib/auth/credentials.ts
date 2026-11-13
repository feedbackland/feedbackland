import "server-only";
import { createHash } from "node:crypto";
import type { BetterAuthOptions } from "better-auth";
import { runWithTransaction } from "@better-auth/core/context";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/schema";

export function credentialAccount(trx: Kysely<DB>, userId: string) {
  return trx
    .selectFrom("auth_account")
    .select(["id", "password"])
    .where("userId", "=", userId)
    .where("providerId", "=", "credential")
    .where("accountId", "=", userId);
}

// The SDK's salted password hash changes on every credential write, including
// setting the same password. Store only its fingerprint on the recovery claim.
export function credentialFingerprint(hash: string) {
  return createHash("sha256").update(hash).digest("hex");
}

// The outer Kysely transaction owns BEGIN/COMMIT and the row locks. Bind SDK
// queries (including nested SDK transactions) to its single connection.
export function withCredentialAdapter<T>(
  trx: Transaction<DB>,
  context: { options: BetterAuthOptions },
  work: () => Promise<T>,
) {
  // The normal adapter validates this same schema. Its introspector obtains
  // a separate connection, which is unavailable on an open Transaction.
  const { advanced } = context.options;
  const adapter = kyselyAdapter(trx, { type: "postgres", transaction: false })({
    ...context.options,
    advanced: {
      ...advanced,
      database: { ...advanced?.database, validateSchema: false },
    },
  });
  return runWithTransaction(adapter, work);
}

export function lockCredentialUser(trx: Transaction<DB>, userId: string) {
  return trx
    .selectFrom("user")
    .select(["id", "email", "role"])
    .where("id", "=", userId)
    .forUpdate()
    .executeTakeFirst();
}

export function revokeResetLinks(trx: Transaction<DB>, userId: string) {
  return trx
    .deleteFrom("auth_verification")
    .where("value", "=", userId)
    .where("identifier", "like", "reset-password:%")
    .execute();
}
