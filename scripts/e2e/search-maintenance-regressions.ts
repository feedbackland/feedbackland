import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { sql } from "kysely";
import { db } from "../../db/db";
import { acquireLease } from "../../lib/jobs/leases";
import { runtimeState } from "../../lib/runtime-state";
import {
  refreshConfigurationLease,
  replicaId,
  startConfigurationLease,
} from "../../lib/llm/settings-store";
import { firstKey, secondKey, type mockOpenRouter } from "../mock-llm";
import { eventually } from "./run";

export async function maintenanceRegressions(
  mock: Awaited<ReturnType<typeof mockOpenRouter>>,
) {
  const children = new Set<ChildProcess>();
  const start = async (key: string, aligned: boolean) => {
    const child = fork(
      resolve("scripts/e2e/search-maintenance-worker.ts"),
      [],
      {
        env: { ...process.env, OPENROUTER_API_KEY: key },
        stdio: ["ignore", "inherit", "inherit", "ipc"],
      },
    );
    children.add(child);
    const ready = await Promise.race([
      once(child, "message"),
      once(child, "exit").then(() => {
        throw Error("Replica exited during boot");
      }),
    ]);
    assert.deepEqual(ready[0], { aligned });
    return child;
  };
  const stop = async (child: ChildProcess, crash = false) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const stopped = once(child, "exit");
    if (crash) child.kill("SIGKILL");
    else child.send("stop");
    await stopped;
    children.delete(child);
  };
  const holder = async () =>
    (
      await sql<{
        holder: string;
        fence: string;
      }>`select holder,fence from job_lease where name='ai-maintenance' and until>clock_timestamp()`.execute(
        db,
      )
    ).rows[0];
  const insert = async (text: string) =>
    (
      await db
        .insertInto("feedback")
        .values({
          title: text,
          description: text,
          plainText: text,
          moderationState: "screened",
        })
        .returning("id")
        .executeTakeFirstOrThrow()
    ).id;
  const indexed = async (id: string) =>
    !!(
      await db
        .selectFrom("feedback")
        .select("embedding")
        .where("id", "=", id)
        .executeTakeFirstOrThrow()
    ).embedding;
  const calls = async () =>
    Number(
      (
        await sql<{
          n: string;
        }>`select coalesce(sum(calls),0) n from llm_usage where feature='backfill'`.execute(
          db,
        )
      ).rows[0].n,
    );
  const normal = mock.handler;
  await db
    .transaction()
    .execute((trx) =>
      refreshConfigurationLease(trx, runtimeState().authSecret!, replicaId()),
    );
  startConfigurationLease();
  try {
    const divergent = await start(secondKey, false);
    await delay(5600);
    assert.equal(await holder(), undefined);
    const good = await start(firstKey, true);
    const id = await insert("Aligned replica fixture");
    await eventually(() => indexed(id), Boolean, 22000);
    assert(await holder());
    good.send("diverge");
    await eventually(holder, (h) => !h, 18000);
    await stop(divergent);
    await stop(good);

    for (const event of ["renewal loss", "process death"] as const) {
      const worker = await start(firstKey, true);
      const old = await eventually(holder, Boolean);
      assert(old);
      const text = "Lease fixture " + event,
        entered = Promise.withResolvers<void>(),
        aborted = Promise.withResolvers<void>();
      let attempts = 0;
      mock.handler = (wire) => {
        if (
          wire.url === "/api/v1/embeddings" &&
          (wire.body.input as string[]).some((v) => v.includes(text))
        ) {
          attempts++;
          if (attempts === 1) {
            wire.response.once("close", () => aborted.resolve());
            entered.resolve();
            return;
          }
        }
        return normal(wire);
      };
      const before = await calls(),
        pending = await insert(text);
      await Promise.race([
        entered.promise,
        delay(20000).then(() => {
          throw Error("Backfill never reached provider");
        }),
      ]);
      assert.equal(await indexed(pending), false);
      if (event === "renewal loss") {
        await sql`update job_lease set until=clock_timestamp() where name='ai-maintenance'`.execute(
          db,
        );
        const substitute = await acquireLease("ai-maintenance");
        assert(substitute);
        try {
          assert(BigInt(substitute.lease.fence) > BigInt(old.fence));
          await Promise.race([
            aborted.promise,
            delay(16000).then(() => {
              throw Error("Renewal loss did not abort HTTP");
            }),
          ]);
          assert.equal(await indexed(pending), false);
          await stop(worker);
        } finally {
          await substitute.release();
        }
      } else {
        await stop(worker, true);
        await aborted.promise;
        assert.equal((await holder())?.holder, old.holder);
        assert.equal(await indexed(pending), false);
      }
      const replacement = await start(firstKey, true);
      await eventually(() => indexed(pending), Boolean, 110000);
      const next = await holder();
      assert(next && BigInt(next.fence) > BigInt(old.fence));
      assert.equal(attempts, 2);
      assert.equal(await calls(), before + 2);
      await stop(replacement);
    }
  } finally {
    mock.handler = normal;
    await Promise.all([...children].map((child) => stop(child, true)));
    clearTimeout(runtimeState().aiLeaseTimer);
  }
}
