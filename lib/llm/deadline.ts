import "server-only";
import { sql, type Transaction } from "kysely";
import { db } from "../../db/db";
import type { DB } from "../../db/schema";
import { sqlstate } from "../log";
import { AiError } from "./errors";

export type Deadline = { signal: AbortSignal; end: number };
export function deadline(
  duration: number,
  external?: AbortSignal,
  start = performance.now(),
): Deadline {
  const end = start + duration;
  const left = Math.ceil(end - performance.now());
  if (left <= 0) throw new AiError("timeout");
  const timeout = AbortSignal.timeout(left);
  return {
    end,
    signal: external ? AbortSignal.any([external, timeout]) : timeout,
  };
}

export function checkDeadline(wall: Deadline) {
  wall.signal.throwIfAborted();
  if (performance.now() >= wall.end) throw new AiError("timeout");
}

// Pool acquisition is cancellable. If cancellation wins during a statement,
// the transaction still owns its connection until its callback rolls back.
export async function withinTransaction<T>(
  wall: Deadline,
  work: (trx: Transaction<DB>) => Promise<T>,
) {
  checkDeadline(wall);
  return new Promise<T>((resolve, reject) => {
    let committing = false;
    const abort = () => {
      if (!committing) reject(wall.signal.reason);
    };
    wall.signal.addEventListener("abort", abort, { once: true });
    db.connection()
      .execute(
        (connection) =>
          connection.transaction().execute(async (trx) => {
            checkDeadline(wall);
            const remaining = String(
              Math.max(1, Math.ceil(wall.end - performance.now())),
            );
            await sql`select set_config('statement_timeout', ${remaining}, true)`.execute(
              trx,
            );
            const result = await work(trx);
            checkDeadline(wall);
            // Keep the outcome of an already-starting COMMIT observable so the
            // transport can reverse committed admission if the signal wins.
            committing = true;
            return result;
          }),
        { signal: wall.signal },
      )
      .then(resolve, (error) => {
        reject(sqlstate(error) === "57014" ? new AiError("timeout") : error);
      })
      .finally(() => wall.signal.removeEventListener("abort", abort));
  });
}
