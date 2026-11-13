import assert from "node:assert/strict";
import { db } from "../../db/db";
import { migrations } from "../../db/migrations";
import { migrateAndSeed } from "../../lib/boot";

/** Exercise the in-place upgrade on the same populated database that receives the HTTP tests. */
export async function upgradeRecoverySchema() {
  await migrateAndSeed({ "0001_init": migrations["0001_init"] });
  const userId = "legacy-credential-owner",
    expiresAt = new Date(Date.now() + 3600_000);
  await db
    .insertInto("user")
    .values({
      id: userId,
      name: "Legacy user",
      email: "legacy@fixture.invalid",
      emailVerified: true,
    })
    .execute();
  await db
    .insertInto("auth_session")
    .values({
      id: "legacy-session",
      token: "fixture-legacy-session",
      userId,
      updatedAt: new Date(),
      expiresAt,
    })
    .execute();
  await db
    .insertInto("auth_verification")
    .values([
      {
        id: "legacy-reset",
        identifier: "reset-password:legacy",
        value: userId,
        expiresAt,
      },
      {
        id: "legacy-popup",
        identifier: "popup-handoff:legacy",
        value: "legacy payload",
        expiresAt,
      },
    ])
    .execute();
  await db
    .insertInto("recovery_claim")
    .values({
      userId,
      codeDigest: "legacy-code",
      owner: "legacy-owner",
      status: "reset",
    })
    .execute();
  const migrated = await migrateAndSeed();
  assert.deepEqual(
    await db
      .selectFrom("auth_verification")
      .select(["id", "value", "resetIssuerId"])
      .execute(),
    [{ id: "legacy-popup", value: "legacy payload", resetIssuerId: null }],
  );
  assert.equal(
    (
      await db
        .selectFrom("auth_session")
        .select("id")
        .where("userId", "=", userId)
        .executeTakeFirstOrThrow()
    ).id,
    "legacy-session",
  );
  assert.deepEqual(
    await db
      .selectFrom("recovery_claim")
      .select(["status", "credentialFingerprint"])
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow(),
    { status: "reset", credentialFingerprint: null },
  );
  return migrated;
}
