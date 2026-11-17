import "server-only";
import { randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import { getPool } from "../../db/db";
import type { DB } from "../../db/schema";
import { AiError } from "../llm/errors";

export type Lease = { name: string; holder: string; fence: string };
type Heartbeat = { fence: string; remaining: number };
const remaining =
  "extract(epoch from (until-clock_timestamp()))::float8*1000 as remaining";

// Only short lease operations use the reserved connection. Destroy a timed-out
// connection so a queued renewal can never get executed on a reused socket.
async function leaseQuery<T extends import("pg").QueryResultRow>(
  statement: string,
  values: string[],
) {
  let held: import("pg").PoolClient | undefined,
    expired = false;
  const timeout = Promise.withResolvers<never>();
  const timer = setTimeout(() => {
    expired = true;
    const client = held;
    held = undefined;
    client?.release(true);
    timeout.reject(new AiError("timeout"));
  }, 5000);
  const run = async () => {
    const client = await getPool(true).connect();
    if (expired) {
      client.release(true);
      throw new AiError("timeout");
    }
    held = client;
    let failed = false;
    try {
      await client.query("begin");
      await client.query("set local statement_timeout='5s'");
      const result = await client.query<T>(statement, values);
      // A combined insight renewal is valid only when the report heartbeat also matched.
      await client.query(result.rowCount ? "commit" : "rollback");
      return result.rows[0];
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (held) {
        held = undefined;
        client.release(failed);
      }
    }
  };
  try {
    return await Promise.race([run(), timeout.promise]);
  } finally {
    clearTimeout(timer);
  }
}
export async function requireLease(trx: Transaction<DB>, lease: Lease) {
  const started = performance.now();
  const row = await trx
    .selectFrom("job_lease")
    .select("until")
    .where("name", "=", lease.name)
    .where("holder", "=", lease.holder)
    .where("fence", "=", lease.fence)
    .forShare()
    .executeTakeFirst();
  if (!row) throw new AiError("RESERVATION_EXPIRED");
  const { rows } = await sql<{
    remaining: number;
  }>`select extract(epoch from (${row.until}::timestamptz-clock_timestamp()))::float8*1000 as remaining`.execute(
    trx,
  );
  if (rows[0].remaining <= 0) throw new AiError("RESERVATION_EXPIRED");
  return started + rows[0].remaining;
}
export async function acquireLease(name: string) {
  const holder = randomUUID(),
    started = performance.now();
  const claim = await leaseQuery<Heartbeat>(
    `insert into job_lease(name,holder,until,fence) values($1,$2,clock_timestamp()+interval '90 seconds',1)
    on conflict(name) do update set holder=excluded.holder,until=clock_timestamp()+interval '90 seconds',fence=job_lease.fence+1
    where job_lease.until<=clock_timestamp() returning fence,${remaining}`,
    [name, holder],
  );
  if (!claim) return null;
  const lease = { name, holder, fence: claim.fence };
  return monitorLease(lease, started + claim.remaining);
}

export async function claimInsightLease(
  trx: Transaction<DB>,
  runId: string,
  holder: string,
) {
  const name = "insight:" + runId;
  const started = performance.now();
  const {
    rows: [claim],
  } = await sql<Heartbeat>`insert into job_lease(name,holder,until,fence)
    values(${name},${holder},clock_timestamp()+interval '90 seconds',1)
    returning fence,extract(epoch from (until-clock_timestamp()))::float8*1000 as remaining`.execute(
    trx,
  );
  return {
    lease: { name, holder, fence: claim.fence },
    expires: started + claim.remaining,
  };
}

export function monitorLease(
  lease: Lease,
  initialExpiry: number,
  runId?: string,
) {
  const { name, holder, fence } = lease;
  const params = [name, holder, fence];
  const controller = new AbortController();
  let expires = initialExpiry,
    timer: ReturnType<typeof setTimeout>,
    expiry: ReturnType<typeof setTimeout>;
  function armExpiry() {
    clearTimeout(expiry);
    expiry = setTimeout(
      () => controller.abort(),
      Math.max(0, expires - performance.now()),
    );
    expiry.unref();
  }
  async function renew() {
    if (controller.signal.aborted) return;
    const start = performance.now();
    try {
      const renewal = `update job_lease set until=clock_timestamp()+interval '90 seconds'
        where name=$1 and holder=$2 and fence=$3 and until>clock_timestamp() returning fence,${remaining}`;
      const row = runId
        ? await leaseQuery<Heartbeat>(
            `with renewed as (${renewal})
        update insight_reports r set "heartbeatAt"=case when r."heartbeatAt" <= clock_timestamp()-interval '30 seconds' then clock_timestamp() else r."heartbeatAt" end
        from renewed where r.id=$4 and r.owner=$2 and r.fence=renewed.fence and r.status='running'
        and r."heartbeatAt">clock_timestamp()-interval '5 minutes' returning renewed.fence,renewed.remaining`,
            [...params, runId],
          )
        : await leaseQuery<Heartbeat>(renewal, params);
      if (!row || controller.signal.aborted || performance.now() >= expires) {
        controller.abort();
        return;
      }
      expires = start + row.remaining;
      armExpiry();
      schedule();
    } catch {
      controller.abort();
    }
  }
  function schedule() {
    timer = setTimeout(renew, 10000);
    timer.unref();
  }
  armExpiry();
  schedule();
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      clearTimeout(expiry);
    },
    { once: true },
  );
  return {
    lease,
    signal: controller.signal,
    async release() {
      controller.abort();
      await leaseQuery(
        "update job_lease set until=clock_timestamp() where name=$1 and holder=$2 and fence=$3",
        params,
      );
    },
  };
}
export type OwnedLease = NonNullable<Awaited<ReturnType<typeof acquireLease>>>;
