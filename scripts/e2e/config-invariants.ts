import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { db } from "../../db/db";
import { runtimeState } from "../../lib/runtime-state";
import {
  AUTH_ENV_TO_NEUTRALISE,
  getConfig,
  neutraliseAuthEnv,
  parseDatabaseOptions,
  validateCode,
} from "../../lib/config";

const names: string[] = JSON.parse(
  readFileSync("ci/fixtures/auth-environment.json", "utf8"),
);
void db;
assert.equal(
  runtimeState().pool,
  undefined,
  "Import constructed a database pool",
);
assert.deepEqual([...AUTH_ENV_TO_NEUTRALISE], names);
neutraliseAuthEnv();
for (const name of names) assert.equal(process.env[name], undefined);
assert.equal(getConfig().llm.apiKey, undefined);
const base = "postgres://fixture:fixture-only@localhost/fixture";
assert.equal(parseDatabaseOptions(base).ssl, false);
for (const selector of ["ssl=false", "sslmode=disable"])
  assert.equal(parseDatabaseOptions(`${base}?${selector}`).ssl, false);
for (const selector of ["ssl=true", "sslmode=verify-full"]) {
  const options = parseDatabaseOptions(`${base}?${selector}`);
  assert.equal(
    (options.ssl as { rejectUnauthorized: boolean }).rejectUnauthorized,
    true,
  );
  assert.equal(new URL(options.connectionString!).searchParams.size, 0);
}
for (const selector of ["sslmode=require", "sslmode=prefer"])
  assert.equal(
    (
      parseDatabaseOptions(`${base}?${selector}`).ssl as {
        rejectUnauthorized: boolean;
      }
    ).rejectUnauthorized,
    false,
  );
for (const selector of [
  "ssl=1",
  "ssl=",
  "sslmode=allow",
  "sslmode=unknown",
  "ssl=true&sslmode=verify-full",
  "sslmode=require&sslmode=require",
  "ssl=true&ssl=true",
  "sslrootcert=local-file",
  "sslcert=x",
  "sslkey=x",
  "sslpassword=x",
  "uselibpqcompat=true",
  "SSL=true",
])
  assert.throws(() => parseDatabaseOptions(`${base}?${selector}`), selector);
assert.throws(() => parseDatabaseOptions(undefined), /DATABASE_URL is not set/);
assert.throws(
  () => parseDatabaseOptions(`${base}?sslmode=verify-ca`),
  /DATABASE_SSL_CA/,
);
assert.throws(() => parseDatabaseOptions(base, "not a PEM"), /DATABASE_SSL_CA/);
for (const selector of [
  "ssl=false",
  "sslmode=disable",
  "sslmode=prefer",
  "sslmode=require",
])
  assert.throws(
    () => parseDatabaseOptions(`${base}?${selector}`, "not a PEM"),
    /DATABASE_SSL_CA/,
  );
const secret = randomBytes(32);
for (const code of [
  secret.toString("hex"),
  secret.toString("hex").toUpperCase(),
  secret.toString("base64"),
])
  assert.equal(validateCode("SETUP_CODE", code), code);
for (const weak of [
  Buffer.alloc(32),
  Buffer.from(Array.from({ length: 32 }, (_, i) => i)),
  Buffer.from(Array.from({ length: 32 }, (_, i) => 255 - i)),
  Buffer.concat([secret.subarray(0, 16), secret.subarray(0, 16)]),
])
  assert.throws(() => validateCode("SETUP_CODE", weak.toString("hex")));
for (const malformed of [
  secret.toString("base64url"),
  secret.toString("base64").replace("=", ""),
  " " + secret.toString("hex"),
])
  assert.throws(() => validateCode("SETUP_CODE", malformed));
console.log(
  "configuration: neutralization, TLS selectors and secret encodings passed",
);
