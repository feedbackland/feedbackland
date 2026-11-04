import assert from "node:assert/strict";
import { Client } from "pg";

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

/** Replace an expired claim after reservation, before the old owner's row lock. */
export async function withRecoveryOwnerReplacement<T>(
  replace: () => Promise<void>,
  action: () => Promise<T>,
) {
  const query = Client.prototype.query;
  let injected = false;
  Client.prototype.query = function (this: Client, ...args: unknown[]) {
    const text =
      typeof args[0] === "string"
        ? args[0]
        : (args[0] as { text?: string })?.text;
    const application = (
      this as Client & { connectionParameters: { application_name?: string } }
    ).connectionParameters.application_name;
    if (
      !injected &&
      application === "feedbackland-recovery" &&
      text?.includes('from "recovery_claim"') &&
      text.includes("for update")
    ) {
      injected = true;
      return replace().then(() => Reflect.apply(query, this, args));
    }
    return Reflect.apply(query, this, args);
  } as typeof query;
  try {
    const result = await action();
    assert(injected);
    return result;
  } finally {
    Client.prototype.query = query;
  }
}
