import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import { chromium } from "playwright";
import { samples } from "./image-fixtures";
import { eventually, toolEnvironment } from "./run";
import { RATE_LIMITS } from "../../lib/rate-limit";
type Docker = (...args: string[]) => Promise<string>;
function fullSizePng() {
  // A valid ancillary PNG text chunk keeps the uploaded raster exactly at the vision byte ceiling.
  const png = samples.png,
    length = 1_000_000 - png.length - 12;
  const chunk = Buffer.alloc(12 + length, 65);
  chunk.writeUInt32BE(length);
  chunk.write("tEXt", 4);
  chunk.write("fixture\u0000", 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
}
export async function productionVision(
  base: string,
  project: string,
  docker: Docker,
) {
  assert.match(base, /^http:\/\/localhost:\d+$/);
  assert.match(project, /^p07-\d+-[a-f0-9]+-ai$/);
  const pg = project + "-pg",
    web = project + "-web",
    provider = project + "-provider";
  const query = async (s: string) =>
    (
      await docker(
        "exec",
        pg,
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        "board_content",
        "-Atqc",
        s,
      )
    ).trim();
  const resetIngress = () =>
    query("delete from rate_limit where key like 'feedback-create:api:%'");
  const count = () => query("select count(*) from feedback");
  const normal = new URL("/api/settings", base).href;
  const urls: string[] = [];
  for (let i = 0; i < 4; i++) {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(fullSizePng())], { type: "image/png" }),
      "fixture.png",
    );
    const res = await fetch(base + "/api/images", {
      method: "POST",
      body: form,
    });
    assert.equal(res.status, 201);
    urls.push((await res.json()).url);
  }
  assert.equal(new Set(urls).size, 4);
  const description = urls.map((src) => `<img src="${src}">`).join("");
  const url = base + "/api/feedback/create";
  const send = (source: number, signal?: AbortSignal) =>
    fetch(url, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "192.0.2." + source,
      },
      body: JSON.stringify({ description }),
    });
  const browser = await chromium.launch({
    env: toolEnvironment() as Record<string, string>,
  });
  const controller = new AbortController();
  const original = Number(await count());
  try {
    const page = await browser.newPage();
    await page.goto(base.replace("localhost", "127.0.0.1") + "/api/health");
    const cross = () =>
      page.evaluate(
        async ({ url, description }) => {
          const res = await fetch(url, {
            method: "POST",
            credentials: "omit",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ description }),
          });
          return {
            status: res.status,
            retry: res.headers.get("retry-after"),
            body: await res.json(),
          };
        },
        { url, description },
      );
    await resetIngress();
    const held = send(10, controller.signal).then(
      async (res) => ({ status: res.status, body: await res.text() }),
      (e) => ({ status: 0, body: e.name }),
    );
    await eventually(
      () => docker("logs", provider),
      (log) => log.includes("Production vision fixture entered 1"),
      10000,
    );
    const capacity = RATE_LIMITS.feedbackCreate.instance.limit,
      perClient = RATE_LIMITS.feedbackCreate.ip.limit;
    // Each fixture client stays inside its own allowance on this isolated board.
    const ordinary = () =>
      fetch(normal, { signal: AbortSignal.timeout(5000) }).then(
        async (response) => {
          assert.equal(response.status, 200);
          assert.equal((await response.json()).isSetupComplete, true);
        },
      );
    const pending = Promise.all([
      cross(),
      ...Array.from({ length: capacity - 2 }, async (_, i) => {
        const res = await send(20 + Math.floor(i / perClient));
        return {
          status: res.status,
          retry: res.headers.get("retry-after"),
          body: await res.json(),
        };
      }),
    ]);
    const [replies] = await Promise.all([pending, ordinary()]);
    for (const reply of replies) {
      assert.equal(reply.status, 429);
      assert.equal(reply.retry, "5");
      assert.equal(reply.body.error, "VISION_BUSY");
    }
    const logs = await docker("logs", provider);
    assert(!logs.includes("Production vision fixture entered 2"));
    const values = (
      await docker(
        "exec",
        web,
        "sh",
        "-ec",
        "if [ -f /sys/fs/cgroup/cgroup.controllers ]; then cat /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.max; else cat /sys/fs/cgroup/memory/memory.max_usage_in_bytes /sys/fs/cgroup/memory/memory.limit_in_bytes; fi",
      )
    )
      .trim()
      .split(/\s+/)
      .map(Number);
    const memory = { peak: values[0], limit: values[1] };
    assert.equal(memory.limit, 512 * 1024 * 1024);
    assert(memory.peak > 0 && memory.peak < memory.limit);
    controller.abort();
    assert.equal((await held).status, 0);
    await eventually(
      () => docker("logs", provider),
      (s) => s.includes("Production vision fixture closed"),
      5000,
    );
    assert.equal(Number(await count()), original);
    await docker("kill", "--signal=USR2", provider);
    await resetIngress();
    const recovered = await send(10);
    assert.equal(recovered.status, 201);
    const { id } = await recovered.json();
    assert.match(id, /^[a-f0-9-]{36}$/);
    assert.equal(
      await query(
        'select count(*) from image_ref where "postId"=\'' + id + "'::uuid",
      ),
      "4",
    );
    assert.equal(Number(await count()), original + 1);
    const visitor = await browser.newContext({
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
    });
    const board = await visitor.newPage();
    await board.goto(base);
    await board
      .getByRole("textbox", { name: "Your feedback" })
      .fill("Budget fixture");
    const improve = board.getByRole("button", { name: "Improve my draft" });
    await improve.waitFor();
    await query(
      "update rate_limit set count=5000 where key='ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')",
    );
    const paused = await cross();
    assert.equal(paused.status, 429);
    assert.equal(paused.body.code, "DAILY_LIMIT");
    assert.match(paused.body.resetsAt, /T00:00:00\.000Z$/);
    assert(Number(paused.retry) > 0);
    for (const [name, button, code] of [
      ["rewriteFeedback", improve, "AI_PAUSED"],
      [
        "createFeedbackPost",
        board.getByRole("button", { name: "Submit feedback" }),
        "DAILY_LIMIT",
      ],
    ] as const) {
      const response = board.waitForResponse(
        (r) =>
          r.url().includes("/api/trpc/" + name) &&
          r.request().method() === "POST",
      );
      await button.click();
      const wire = await response;
      const { data } = (await wire.json())[0].error.json;
      assert.equal(wire.status(), 429);
      assert.equal(data.contentCode, code);
      assert.equal(data.resetsAt, paused.body.resetsAt);
      assert(Number(wire.headers()["retry-after"]) > 0);
      const when = await board.evaluate(
        (value) =>
          new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(value)),
        data.resetsAt,
      );
      await board
        .getByRole("alert")
        .filter({
          hasText:
            (code === "AI_PAUSED"
              ? "Draft improvements are paused until "
              : "Anonymous posting is paused until ") + when,
        })
        .waitFor();
    }
    await visitor.close();
    return {
      submissions: capacity,
      busy: replies.length,
      normalRoute: "passed",
      disconnectAndReuse: "passed",
      memory,
      crossOriginRetry: "passed",
    };
  } finally {
    controller.abort();
    await browser.close();
  }
}
