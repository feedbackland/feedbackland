import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { sql } from "kysely";
import { z } from "zod/v4";
import { db } from "../../db/db";
import { getClientIp } from "../client-ip";
import { checkRateLimit } from "../../queries/check-rate-limit";
import type { HandoffDependencies, HandoffValue } from "./popup-handoff";

const valueSchema = z
  .object({
    h: z.string().regex(/^[a-f0-9]{64}$/),
    mode: z.enum(["embedded", "first-party"]),
    state: z.enum(["pending", "done", "error"]),
    token: z.string().optional(),
    error: z.string().max(80).optional(),
  })
  .strict();
const key = (ticket: string) => `popup-handoff:${ticket}`;
function parse(value: string): HandoffValue {
  return valueSchema.parse(JSON.parse(value));
}
export const handoffStore: HandoffDependencies = {
  async allowed(headers) {
    return (
      await checkRateLimit({
        key: `popup-handoff:ip:${getClientIp(headers)}`,
        limit: 120,
        windowSeconds: 60,
      })
    ).allowed;
  },
  async reserve(ticket, value) {
    return !!(await db
      .insertInto("auth_verification")
      .values({
        id: key(ticket),
        identifier: key(ticket),
        value: JSON.stringify(value),
        expiresAt: sql`clock_timestamp()+interval '10 minutes'`,
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .returning("id")
      .executeTakeFirst());
  },
  async read(ticket) {
    const row = await db
      .selectFrom("auth_verification")
      .select("value")
      .where("id", "=", key(ticket))
      .where("expiresAt", ">", sql<Date>`clock_timestamp()`)
      .executeTakeFirst();
    return row ? parse(row.value) : null;
  },
  async bind(ticket, previous, next) {
    return !!(await db
      .updateTable("auth_verification")
      .set({ value: JSON.stringify(next), updatedAt: sql`clock_timestamp()` })
      .where("id", "=", key(ticket))
      .where("value", "=", JSON.stringify(previous))
      .where("expiresAt", ">", sql<Date>`clock_timestamp()`)
      .returning("id")
      .executeTakeFirst());
  },
  async claim(ticket, secret) {
    return db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom("auth_verification")
        .select(["value", "expiresAt"])
        .select(sql<Date>`clock_timestamp()`.as("now"))
        .where("id", "=", key(ticket))
        .forUpdate()
        .executeTakeFirst();
      if (!row || row.expiresAt <= row.now) return { kind: "missing" as const };
      const value = parse(row.value);
      const actual = createHash("sha256").update(secret).digest();
      if (!timingSafeEqual(actual, Buffer.from(value.h, "hex")))
        return { kind: "forbidden" as const };
      if (value.state === "pending") return { kind: "pending" as const };
      await trx
        .deleteFrom("auth_verification")
        .where("id", "=", key(ticket))
        .execute();
      return { kind: "bound" as const, value };
    });
  },
};
