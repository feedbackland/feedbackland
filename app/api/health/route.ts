import { getPool } from "@/db/db";
import identity from "@/lib/build-identity.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One actual probe at a time, including when HTTP callers time out. A request
// storm must not turn a stalled pool into an unbounded queue of health queries.
let inFlight: Promise<boolean> | undefined;
function probe() {
  if (!inFlight) {
    inFlight = getPool()
      .connect()
      .then(async (client) => {
        let failed = false;
        try {
          // pg supports this per-query option; @types/pg exposes it only on
          // ClientConfig. Keep the real option without changing app query limits.
          const query = { text: "SELECT 1", query_timeout: 1_750 };
          await client.query(query);
          return true;
        } catch {
          failed = true;
          return false;
        } finally {
          client.release(failed);
        }
      })
      .catch(() => false)
      .finally(() => {
        inFlight = undefined;
      });
  }
  return inFlight;
}

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ok = await Promise.race([
    probe(),
    new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), 1_900);
    }),
  ]).finally(() => clearTimeout(timer));
  return Response.json(
    { status: ok ? "ok" : "down", version: identity.version },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
