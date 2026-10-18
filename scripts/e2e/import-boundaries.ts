import assert from "node:assert/strict";
import { lazyDelegate } from "../../lib/lazy-delegate";
import * as browserSdk from "firebase/app";
import * as adminSdk from "firebase-admin/app";
import * as authSdk from "firebase/auth";

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
  assert.equal(browserSdk.getApps().length, 0);
  assert.equal(adminSdk.getApps().length, 0);
  const client = await import("../../lib/firebase/client");
  const admin = await import("../../lib/firebase/admin");
  const storage = await import("../../lib/supabase");
  assert.equal(
    browserSdk.getApps().length,
    0,
    "import initialized browser SDK",
  );
  assert.equal(adminSdk.getApps().length, 0, "import initialized admin SDK");
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
  // Exercise first use only with fixture identities, never the hosted project.
  const { firebaseConfig } = await import("../../firebaseConfig");
  Object.assign(firebaseConfig, {
    apiKey: "fixture-api-key",
    authDomain: "localhost",
    projectId: "p01-fixture",
    appId: "p01-fixture",
  });
  assert.equal(client.app.options.projectId, "p01-fixture");
  assert.equal(client.auth.app.options.projectId, "p01-fixture");
  assert.equal(browserSdk.getApps().length, 1);
  await client.auth.authStateReady();
  const unsubscribe = authSdk.onAuthStateChanged(client.auth, () => {});
  unsubscribe();
  const adminApp = adminSdk.initializeApp({ projectId: "p01-fixture" });
  assert.equal(admin.adminAuth.app, adminApp);
  assert.equal(admin.adminAuth.getUser, admin.adminAuth.getUser);
  await authSdk.signOut(client.auth);
  await browserSdk.deleteApp(browserSdk.getApps()[0]);
  await adminSdk.deleteApp(adminApp);
  console.log(
    "import boundaries: passed (fixture identities, no hosted requests)",
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
