import assert from "node:assert/strict";
import { Client } from "pg";
import { getAuth } from "../../lib/auth/server";
import { getPool } from "../../db/db";

/** Hide an acknowledgement only after the real final transaction commits. */
export async function withRecoveryCommitAckLoss<T>(action: () => Promise<T>) {
  const query = Client.prototype.query;
  const final = new WeakSet<Client>();
  let injected = false;
  Client.prototype.query = function (this: Client, ...args: unknown[]) {
    const text =
      typeof args[0] === "string"
        ? args[0]
        : (args[0] as { text?: string })?.text;
    const parameters = (
      typeof args[0] === "object"
        ? (args[0] as { values?: unknown[] }).values
        : args[1]
    ) as unknown[] | undefined;
    if (
      text?.startsWith('update "recovery_claim"') &&
      parameters?.includes("promoted")
    )
      final.add(this);
    const result: unknown = Reflect.apply(query, this, args);
    if (
      !injected &&
      final.has(this) &&
      text?.trim().toUpperCase() === "COMMIT"
    ) {
      injected = true;
      assert(result instanceof Promise);
      return result.then(() => {
        throw Object.assign(
          new Error("Fixture recovery acknowledgement loss"),
          { code: "08006" },
        );
      });
    }
    return result;
  } as typeof query;
  try {
    const result = await action();
    assert(injected);
    return result;
  } finally {
    Client.prototype.query = query;
  }
}

/** Run a competing operation after the real KDF and before its result is used. */
export async function duringPasswordWork<T>(
  stage: "hash" | "verify",
  action: () => Promise<T>,
  interleave: () => Promise<void>,
) {
  const { password } = await getAuth().$context;
  let entered = false;
  const checkpoint = async () => {
    if (entered) return;
    entered = true;
    await interleave();
  };
  const { hash, verify } = password;
  if (stage === "hash")
    password.hash = async (input) => {
      const result = await hash(input);
      await checkpoint();
      return result;
    };
  else
    password.verify = async (input) => {
      const result = await verify(input);
      if (result) await checkpoint();
      return result;
    };
  try {
    return await action();
  } finally {
    password.hash = hash;
    password.verify = verify;
    assert(entered, "The request did not reach the credential checkpoint");
  }
}

/** Lose the backend after the actual SDK write, before the marker and COMMIT. */
export async function withRecoveryConnectionLoss(
  action: () => Promise<unknown>,
) {
  const query = Client.prototype.query;
  let terminated = false;
  Client.prototype.query = function (this: Client, ...args: unknown[]) {
    const text =
      typeof args[0] === "string"
        ? args[0]
        : (args[0] as { text?: string })?.text;
    const result: unknown = Reflect.apply(query, this, args);
    if (
      !terminated &&
      text?.startsWith('update "auth_account"') &&
      text.includes('"password"')
    ) {
      terminated = true;
      assert(result instanceof Promise);
      return result.then(async (value) => {
        const pid = (this as Client & { processID: number }).processID;
        const killed = await getPool(true).query(
          "select pg_terminate_backend($1, 5000) as ok",
          [pid],
        );
        assert(killed.rows[0].ok);
        return value;
      });
    }
    return result;
  } as typeof query;
  try {
    await assert.rejects(action, /password may already/);
    assert(terminated);
  } finally {
    Client.prototype.query = query;
  }
}
