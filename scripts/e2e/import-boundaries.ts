import assert from "node:assert/strict";
import { lazyDelegate } from "../../lib/lazy-delegate";
import { readFile } from "node:fs/promises";
import { command } from "./run";

let calls = 0;
class Fixture {
  #value = 7;
  value() {
    return this.#value;
  }
}
const delegated = lazyDelegate(() => {
  calls++;
  if (calls === 1) throw new Error("fixture initialization failed");
  return new Fixture();
});
assert.equal(calls, 0);
assert.throws(() => delegated.value(), /fixture initialization failed/);
const method = delegated.value;
assert.equal(method(), 7); // Private field requires the actual SDK receiver.
assert.equal(method, delegated.value);
assert.equal(calls, 2);

async function main() {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert(!pkg.dependencies.firebase && !pkg.dependencies["firebase-admin"]);
  await command(process.execPath, [
    "--conditions=react-server",
    "--import",
    "tsx",
    "-e",
    "const assert=require('node:assert/strict');require('./lib/auth/server.ts');const s=require('./lib/runtime-state.ts').runtimeState();assert.equal(s.auth,undefined);assert.equal(s.pool,undefined);assert.equal(s.db,undefined);",
  ]);
  const storage = await import("../../lib/supabase");
  // Missing credentials would make an eager Supabase factory throw at import.
  assert.throws(() => storage.supabase.storage, /supabaseKey/);
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID = "p01-fixture";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "p01-fixture-anonymous-key";
  const bucket = storage.supabase.storage.from("images");
  assert.match(
    bucket.getPublicUrl("fixture.png").data.publicUrl,
    /fixture.png$/,
  );
  assert.equal(storage.supabase.storage, storage.supabase.storage);
  console.log(
    "import boundaries: passed (fixture identities, no hosted requests)",
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
