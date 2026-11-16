import "server-only";
import { sql, type Transaction } from "kysely";
import { db, getPool } from "./db";
import type { DB } from "./schema";
import { DomainError } from "../lib/domain-error";
import { log, sqlstate } from "../lib/log";

// A content transaction owns its backend until cancellation has finished.
// The reserved connection can interrupt a blocked statement even when all
// ordinary connections are busy, including behind a transaction-mode pooler.
export async function contentTransaction<T>(
  request: AbortSignal | undefined,
  work: (trx: Transaction<DB>) => Promise<T>,
  isolation: "read committed" | "repeatable read" = "read committed",
) {
  const duration = 5000;
  const end = performance.now() + duration;
  const timeout = AbortSignal.timeout(duration);
  const signal = request ? AbortSignal.any([request, timeout]) : timeout;
  try {
    return await db.connection().execute(
      (connection) =>
        connection
          .transaction()
          .setIsolationLevel(isolation)
          .execute(async (trx) => {
            signal.throwIfAborted();
            const remaining = String(
              Math.max(1, Math.ceil(end - performance.now())),
            );
            const { rows } = await sql<{
              pid: number;
            }>`select pg_backend_pid() as pid,
          set_config('statement_timeout', ${remaining}, true),
          set_config('lock_timeout', ${remaining}, true)`.execute(trx);
            let cancellation: Promise<unknown> | undefined;
            const interrupt = () => {
              cancellation = getPool(true)
                .query("select pg_cancel_backend($1)", [rows[0].pid])
                .catch((error) => {
                  log(
                    "database.cancel-failed",
                    { sqlstate: sqlstate(error) },
                    "warn",
                  );
                });
            };
            signal.addEventListener("abort", interrupt, { once: true });
            try {
              signal.throwIfAborted();
              const result = await work(trx);
              signal.throwIfAborted();
              if (performance.now() >= end)
                throw new DomainError(
                  "SERVICE_UNAVAILABLE",
                  "CONTENT_WRITE_BUSY",
                  1,
                );
              return result;
            } finally {
              signal.removeEventListener("abort", interrupt);
              // Never release or reuse this backend while the cancellation is in flight.
              if (cancellation) await cancellation;
            }
          }),
      { signal },
    );
  } catch (error) {
    if (request?.aborted)
      throw new DomainError("CLIENT_CLOSED_REQUEST", "REQUEST_CANCELLED");
    if (timeout.aborted || ["55P03", "57014"].includes(sqlstate(error) ?? ""))
      throw new DomainError("SERVICE_UNAVAILABLE", "CONTENT_WRITE_BUSY", 1);
    throw error;
  }
}
