import assert from "node:assert/strict";
import { pool } from "../../db/db";
import { GET } from "../../app/api/health/route";

async function main() {
  let connections = 0;
  let rejectConnect: (error: Error) => void = () => {
    throw new Error("probe was not started");
  };
  const unhandled: unknown[] = [];
  const onUnhandled = (error: unknown) => {
    unhandled.push(error);
  };
  process.on("unhandledRejection", onUnhandled);
  const original = Object.getOwnPropertyDescriptor(pool, "connect");
  Object.defineProperty(pool, "connect", {
    configurable: true,
    value: () => {
      connections++;
      return new Promise((_resolve, reject) => {
        rejectConnect = reject;
      });
    },
  });
  try {
    const started = Date.now();
    const requests = Array.from({ length: 40 }, () => GET());
    assert.equal(
      connections,
      1,
      "HTTP concurrency queued multiple real probes",
    );
    const responses = await Promise.all(requests);
    assert(responses.every((response) => response.status === 503));
    assert(Date.now() - started < 2_500);
    // Even after every caller times out, the pending acquisition retains its
    // one slot. A late rejection must be handled and then allow recovery.
    const extra = GET();
    assert.equal(connections, 1);
    rejectConnect(new Error("fixture late acquisition failure"));
    assert.equal((await extra).status, 503);
    await new Promise((resolve) => setImmediate(resolve));
    Object.defineProperty(pool, "connect", {
      configurable: true,
      value: async () => {
        connections++;
        return {
          query: async () => ({ rows: [{ "?column?": 1 }] }),
          release: (failed: boolean) => assert.equal(failed, false),
        };
      },
    });
    assert.equal((await GET()).status, 200);
    assert.equal(connections, 2);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
    console.log(
      "readiness bounds: passed (single pending probe, deadline, late rejection, recovery)",
    );
  } finally {
    process.off("unhandledRejection", onUnhandled);
    if (original) Object.defineProperty(pool, "connect", original);
    else Reflect.deleteProperty(pool, "connect");
    await pool.end();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
