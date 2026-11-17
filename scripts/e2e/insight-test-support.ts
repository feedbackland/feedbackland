import assert from "node:assert/strict";
import { sql } from "kysely";
import { db } from "../../db/db";
import { eventually } from "./run";
export const admin = { userId: "insight-admin", sessionId: "insight-session" };
export const report = (id: string) =>
  db
    .selectFrom("insight_reports")
    .where("id", "=", id)
    .selectAll()
    .executeTakeFirstOrThrow();
export const calls = async () =>
  Number(
    (
      await db
        .selectFrom("llm_usage")
        .where("feature", "=", "insights")
        .select((e) => e.fn.sum("calls").as("n"))
        .executeTakeFirstOrThrow()
    ).n,
  );
export async function budget(runId?: string) {
  const day = runId
    ? sql`(select "reservationDay" from insight_reports where id=${runId})`
    : sql`(clock_timestamp() at time zone 'UTC')::date`;
  const row = await db
    .selectFrom("rate_limit")
    .where(
      "key",
      "=",
      sql<string>`'ai:instance:day:'||to_char(${day},'YYYY-MM-DD')`,
    )
    .select("count")
    .executeTakeFirst();
  return row?.count ?? 0;
}
export async function setBudget(count: number) {
  await sql`insert into rate_limit(key,count,"windowStart") values('ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'),${count},clock_timestamp()) on conflict(key) do update set count=excluded.count`.execute(
    db,
  );
}
export async function ended(id: string, reason?: string) {
  const row = await eventually(
    () => report(id),
    (r) => r.status !== "running",
    15000,
  );
  assert.equal(row.status, reason ? "failed" : "succeeded", String(row.error));
  assert.equal(row.error, reason ?? null);
  assert.equal(row.inputSnapshot, null);
  assert.equal(row.requestPlan, null);
  assert(row.finishedAt);
  assert.equal(row.stage, "complete");
  return row;
}
export async function setup() {
  await db
    .updateTable("settings")
    .set({ setupCompletedAt: new Date() })
    .execute();
  for (const id of [admin.userId, "insight-voter"]) {
    await db
      .insertInto("user")
      .values({
        id,
        email: id + "@example.invalid",
        name: "Fixture",
        emailVerified: true,
        role: id === admin.userId ? "admin" : "user",
      })
      .execute();
    await db
      .insertInto("auth_session")
      .values({
        id: id === admin.userId ? admin.sessionId : id,
        token: id,
        userId: id,
        scope: "first-party",
        expiresAt: new Date(Date.now() + 600_000),
        updatedAt: new Date(),
      })
      .execute();
  }
}
export async function seed(n: number) {
  await sql`insert into feedback(title,description,"plainText","moderationState","authorId","createdAt") select 'Fixture '||n,'Body','Body','screened','insight-admin',statement_timestamp()-n*interval '1 second' from generate_series(1,${n}::int)n`.execute(
    db,
  );
}
