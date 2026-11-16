import { db } from "../../db/db";
import { migrateAndSeed } from "../../lib/boot";
import { runtimeState } from "../../lib/runtime-state";
import { startConfigurationLease } from "../../lib/llm/settings-store";
import { startMaintenance } from "../../lib/jobs/maintenance";
import { secondKey } from "../mock-llm";

async function main() {
  const boot = await migrateAndSeed();
  runtimeState().authSecret = boot.authSecret;
  startConfigurationLease();
  startMaintenance();
  process.on("message", async (message) => {
    if (message === "diverge") process.env.OPENROUTER_API_KEY = secondKey;
    if (message === "stop") {
      await runtimeState().aiMaintenance?.stop();
      clearTimeout(runtimeState().aiLeaseTimer);
      await db.destroy();
      await runtimeState().maintenancePool?.end();
      process.disconnect?.();
    }
  });
  process.send?.({ aligned: boot.aiAligned });
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
