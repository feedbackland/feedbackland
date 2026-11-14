import assert from "node:assert/strict";
import { request, type ClientRequest } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { eventually } from "./run";
import { boundary, disposition, multipart, samples } from "./image-fixtures";
export async function sendImage(base: string, bytes = samples.png) {
  return fetch(base + "/api/images", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=" + boundary },
    body: new Uint8Array(
      multipart(bytes, disposition + "\r\nContent-Type: text/plain"),
    ),
  });
}
function start(base: string, path: string, headers: Record<string, string>) {
  let client!: ClientRequest;
  const result = new Promise<{ status: number; retry: string | undefined }>(
    (resolve, reject) => {
      client = request(base + path, { method: "POST", headers }, (res) => {
        res.resume();
        res.once("end", () =>
          resolve({
            status: res.statusCode!,
            retry: res.headers["retry-after"],
          }),
        );
      });
      client.on("error", reject);
      client.setTimeout(40_000, () =>
        client.destroy(new Error("HTTP fixture timed out")),
      );
      client.flushHeaders();
    },
  );
  void result.catch(() => {});
  return { client, result };
}
export async function streamContracts(
  base: string,
  app: string,
  docker: (...args: string[]) => Promise<string>,
) {
  const media = { "content-type": "multipart/form-data; boundary=" + boundary };
  const header = Buffer.from(
    "--" + boundary + "\r\n" + disposition + "\r\n\r\n",
  );
  const held = [
    start(base, "/api/images", media),
    start(base, "/api/images", media),
  ];
  for (const r of held) r.client.write(header);
  try {
    // Bound the admission check without waiting for the five-second idle timeout.
    await delay(350);
    const busy = await sendImage(base);
    assert.equal(busy.status, 429);
    assert.equal(busy.headers.get("retry-after"), "5");
    assert.equal((await fetch(base + "/api/health")).status, 200);
    held[0].client.destroy();
    assert.equal((await held[1].result).status, 408);
    assert.equal((await sendImage(base)).status, 201);
  } finally {
    for (const r of held) r.client.destroy();
  }
  const trickle = start(base, "/api/images", media);
  trickle.client.write(header);
  const pulse = setInterval(() => trickle.client.write("x"), 800);
  try {
    assert.equal((await trickle.result).status, 408);
  } finally {
    clearInterval(pulse);
    trickle.client.destroy();
  }
  const paths = [
    "/api/images",
    "/api/feedback/create",
    "/api/trpc/createFeedbackPost",
    "/api/auth/sign-up/email",
  ];
  const offered = 50_000_000;
  // Sample the production server inside its own container throughout the writes.
  // The measurement process has a separate PID and cannot inflate PID 1's RSS.
  const script =
    "const fs=require('node:fs');const rss=()=>Number(fs.readFileSync('/proc/1/status','utf8').match(/VmRSS:\\s+(\\d+)/)[1])*1024;const before=rss();let peak=before;fs.writeFileSync('/tmp/p06-rss-ready','');const t=setInterval(()=>{peak=Math.max(peak,rss());if(fs.existsSync('/tmp/p06-rss-stop')){clearInterval(t);console.log(JSON.stringify({before,peak}));}},5);setTimeout(()=>process.exit(2),90000).unref();";
  const monitor = docker("exec", app, "node", "-e", script);
  void monitor.catch(() => {});
  let maxSent = 0;
  try {
    await eventually(
      () => docker("exec", app, "test", "-e", "/tmp/p06-rss-ready"),
      () => true,
      15_000,
    );
    for (const path of paths) {
      const content =
        path === "/api/images" ? media : { "content-type": "application/json" };
      for (const declared of [true, false]) {
        const { client, result } = start(base, path, {
          ...content,
          ...(declared ? { "content-length": String(offered) } : {}),
        });
        let finished = false;
        void result
          .finally(() => {
            finished = true;
          })
          .catch(() => {});
        let sent = 0;
        const block = Buffer.alloc(16384, 0x61);
        try {
          if (path === "/api/images") {
            client.write(header);
            sent += header.length;
          }
          while (!finished && sent < offered) {
            // Respect transport backpressure and give the server time to return an early response.
            if (client.writableLength < 65536) {
              const n = Math.min(block.length, offered - sent);
              client.write(block.subarray(0, n));
              sent += n;
            }
            await delay(1);
          }
          if (sent === offered) client.end();
          assert.equal((await result).status, 413, path);
          maxSent = Math.max(sent, maxSent);
        } finally {
          client.destroy();
        }
      }
    }
  } finally {
    await docker("exec", app, "touch", "/tmp/p06-rss-stop");
  }
  const rss = JSON.parse(await monitor) as { before: number; peak: number };
  assert(
    rss.peak - rss.before < 32 * 1024 * 1024,
    "50 MB stream RSS growth: " + (rss.peak - rss.before),
  );
  assert(
    maxSent < offered,
    "The application buffered the entire proposed body",
  );
  return {
    offeredBytes: offered,
    largestClientWrite: maxSent,
    serverRssGrowth: rss.peak - rss.before,
    slots: 2,
    idleSeconds: 5,
    wallSeconds: 30,
  };
}
