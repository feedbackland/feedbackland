import "server-only";
import { performance } from "node:perf_hooks";
import { sql, type Transaction } from "kysely";
import { db } from "../../db/db";
import type { DB } from "../../db/schema";
import { sqlstate } from "../log";
import { BodyError } from "../http/limited-body";

export function uploadDeadline(requestSignal: AbortSignal, duration = 30_000) {
  const end = performance.now() + duration;
  const signal = AbortSignal.any([
    requestSignal,
    AbortSignal.timeout(duration),
  ]);
  function remaining() {
    if (requestSignal.aborted) throw new BodyError(400, "BODY_INTERRUPTED");
    const ms = Math.ceil(end - performance.now());
    if (ms <= 0 || signal.aborted) throw new BodyError(408, "UPLOAD_TIMEOUT");
    return ms;
  }
  return { remaining, signal };
}
export type UploadDeadline = ReturnType<typeof uploadDeadline>;

type RunStatement = <T>(query: () => Promise<T>) => Promise<T>;
export async function uploadTransaction<T>(
  deadline: UploadDeadline,
  work: (trx: Transaction<DB>, run: RunStatement) => Promise<T>,
) {
  deadline.remaining();
  try {
    return await db.connection().execute(
      (connection) =>
        connection.transaction().execute(async (trx) => {
          // The server bounds each statement by the remaining request time.
          // Keep the connection and slot until any outstanding work and rollback
          // have settled, including with a transaction-mode pooler.
          async function run<R>(query: () => Promise<R>) {
            const ms = String(deadline.remaining());
            await sql`select set_config('statement_timeout', ${ms}, true), set_config('lock_timeout', ${ms}, true)`.execute(
              trx,
            );
            deadline.remaining();
            return query();
          }
          const result = await work(trx, run);
          deadline.remaining();
          return result;
        }),
      { signal: deadline.signal },
    );
  } catch (error) {
    deadline.remaining();
    if (["55P03", "57014"].includes(sqlstate(error) ?? ""))
      throw new BodyError(408, "UPLOAD_TIMEOUT");
    throw error;
  }
}
