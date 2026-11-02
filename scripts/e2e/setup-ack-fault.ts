import assert from "node:assert/strict";
import { Client } from "pg";

/** Execute the real transaction boundary, then hide its acknowledgement. */
export async function withSetupAckLoss<T>(
  statement: "COMMIT" | "ROLLBACK",
  action: () => Promise<T>,
) {
  const original = Client.prototype.query;
  let injected = false;
  Client.prototype.query = function (this: Client, ...args: unknown[]) {
    const text =
      typeof args[0] === "string"
        ? args[0]
        : (args[0] as { text?: string } | undefined)?.text;
    const application = (
      this as Client & {
        connectionParameters: { application_name?: string };
      }
    ).connectionParameters.application_name;
    const result: unknown = Reflect.apply(original, this, args);
    if (
      !injected &&
      application === "feedbackland-setup" &&
      text?.trim().toUpperCase() === statement
    ) {
      injected = true;
      assert(result instanceof Promise);
      return result.then(() => {
        throw Object.assign(
          new Error("Fixture transaction acknowledgement lost"),
          {
            code: "08006",
          },
        );
      });
    }
    return result;
  } as typeof original;
  try {
    const result = await action();
    assert(
      injected,
      `The setup ${statement} acknowledgement fault was not exercised`,
    );
    return result;
  } finally {
    Client.prototype.query = original;
  }
}
