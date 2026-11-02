import assert from "node:assert/strict";
import { reserveSignIn } from "../../lib/auth/sign-in-limit";
import { getPool } from "../../db/db";

async function main() {
  const email = process.argv[2];
  assert.equal(email, "replicas@fixture.invalid");
  const permits = await Promise.all(
    Array.from({ length: 20 }, () => reserveSignIn(email)),
  );
  for (const permit of permits) await permit?.complete(true);
  console.log(JSON.stringify({ admitted: permits.filter(Boolean).length }));
}
void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
