import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import type { Page } from "playwright";
import { failureText } from "./ask-ai-provider";
import { privateMarker } from "../mock-llm";
import { eventually } from "./run";

const question = (text: string) => ({
  messages: [{ role: "user", parts: [{ type: "text", text }] }],
  timeZone: "Pacific/Auckland",
});

export async function askAiHttp(
  page: Page,
  origin: string,
  sql: (statement: string) => Promise<string>,
  providerLogs: () => Promise<string>,
) {
  const post = (
    data: Record<string, unknown> | string,
    headers: Record<string, string> = {},
  ) =>
    page.request.post(origin + "/api/chat", {
      data,
      headers: { origin, "content-type": "application/json", ...headers },
      timeout: 10000,
    });
  const secretFree = async (response: Awaited<ReturnType<typeof post>>) => {
    const text = await response.text();
    assert(!text.includes(privateMarker), "provider text in Ask AI response");
    assert.equal(response.headers()["cache-control"], "no-store");
    return text;
  };
  const usage = () =>
    sql(`select concat(coalesce(sum(calls),0),'/',coalesce(sum(errors),0),'/',coalesce(sum("costUsd"),0)::float8)
    from llm_usage where feature='ask-ai'`);
  assert.equal(await usage(), "0/0/0");
  const publicReply = await fetch(origin + "/api/chat", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(question("What changed?")),
  });
  assert.equal(publicReply.status, 401);
  const crossSite = await post(question("What changed?"), {
    "sec-fetch-site": "cross-site",
  });
  assert.equal(crossSite.status(), 403);
  const invalidCases = [
    {
      messages: [
        { role: "system", parts: [{ type: "text", text: "Unexpected role" }] },
      ],
    },
    {
      messages: [
        { role: "user", parts: [{ type: "file", url: "file.invalid" }] },
      ],
    },
    question("🧪".repeat(1001)),
    question(" "),
  ];
  for (const input of invalidCases) {
    const response = await post(input);
    assert.equal(response.status(), 400);
    assert.deepEqual(await response.json(), { error: "INVALID_CHAT_INPUT" });
  }
  const oversized = await post(
    JSON.stringify({ data: "x".repeat(1024 * 1024) }),
  );
  assert.equal(oversized.status(), 413);
  const cookies = (await page.context().cookies(origin))
    .map(({ name, value }) => name + "=" + value)
    .join("; ");
  const oversizedStatus = (declared: boolean) =>
    new Promise<number>((resolve, reject) => {
      const load = httpRequest(
        origin + "/api/chat",
        {
          method: "POST",
          signal: AbortSignal.timeout(8000),
          headers: {
            origin,
            cookie: cookies,
            "content-type": "application/json",
            ...(declared ? { "content-length": 50 * 1024 * 1024 } : {}),
          },
        },
        (response) => {
          response.resume();
          response.once("end", () => {
            resolve(response.statusCode ?? 0);
            load.destroy();
          });
        },
      );
      load.once("error", reject);
      if (declared) load.flushHeaders();
      else {
        const chunk = Buffer.alloc(64 * 1024, 0x20);
        for (let i = 0; i < 18; i++) load.write(chunk);
        load.end();
      }
    });
  assert.equal(await oversizedStatus(true), 413);
  assert.equal(await oversizedStatus(false), 413);
  assert.equal(await usage(), "0/0/0");

  await page.goto(origin + "/admin/ask-ai");
  await page
    .getByPlaceholder("Ask about your feedback…")
    .fill("What happened on the board?");
  const streamed = page.waitForResponse((res) =>
    res.url().endsWith("/api/chat"),
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const answer = await streamed;
  assert.equal(answer.status(), 200);
  assert.match(
    (await answer.allHeaders())["content-type"],
    /^text\/event-stream/,
  );
  assert((await answer.text()).includes('"type":"text-delta"'));
  await page.getByText(/Feedbackland fixture response/).waitFor();
  const cited = page.getByRole("link", { name: /^Source 1(?::|$)/ });
  await cited.waitFor();
  const target = new URL((await cited.getAttribute("href"))!, origin);
  assert.equal(target.origin, origin);
  assert.match(target.pathname, /^\/[0-9a-f-]{36}$/);
  assert.equal(await usage(), "1/0/0.024");

  const failures = [401, 402, 429, 500];
  for (const status of failures) {
    const response = await post(question(failureText + " " + status));
    assert.equal(response.status(), 503);
    assert.deepEqual(JSON.parse(await secretFree(response)), {
      error: "AI_UNAVAILABLE",
    });
  }
  const interrupted = await post(question("P12 interrupted answer"));
  assert.equal(interrupted.status(), 200);
  const raw = await secretFree(interrupted);
  assert(raw.includes("Feedbackland fixture response"));
  assert(raw.includes('"errorText":"AI_UNAVAILABLE"'));
  assert.equal(await usage(), "6/5/0.024");

  // Overload both the corpus and conversation. Only the newest complete records
  // and the allowed message/byte budgets may reach the provider.
  await sql(`insert into feedback(title,description,"plainText","createdAt","moderationState")
    select 'P12 corpus fixture '||n, repeat('界',500), repeat('界',500), now()-n*interval '1 millisecond', 'disabled'
    from generate_series(1,310) n`);
  try {
    const turn = (role: string, text: string) => ({
      role,
      parts: [{ type: "text", text }],
    });
    const request = await post({
      messages: [
        ...Array.from({ length: 12 }, (_, i) =>
          turn(i % 2 ? "assistant" : "user", "é".repeat(2000)),
        ),
        turn("user", "🧪".repeat(1000)),
      ],
    });
    assert.equal(request.status(), 200);
    assert((await secretFree(request)).includes('"type":"finish"'));
    const samples = (await providerLogs())
      .split(/\r?\n/)
      .filter((line) => line.startsWith('{"askTextBytes"'))
      .map(
        (line) =>
          JSON.parse(line) as {
            askTextBytes: number;
            historyBytes: number;
            historyRows: number;
            corpusRows: number;
            cache: string;
          },
      );
    const maximum = samples.at(-1);
    assert(maximum);
    assert(maximum.askTextBytes > 126800 && maximum.askTextBytes <= 128000);
    assert.equal(maximum.historyBytes, 16000);
    assert.equal(maximum.historyRows, 4);
    assert.equal(maximum.cache, "part");
    assert(maximum.corpusRows > 0 && maximum.corpusRows <= 300);

    await sql("update rate_limit set count=10 where key like 'ask-ai:user:%'");
    const perUser = await post(question("Only checking the user limit"));
    assert.equal(perUser.status(), 429);
    assert.equal((await perUser.json()).error, "AI_BUSY");
    await sql("delete from rate_limit where key like 'ask-ai:user:%'");
    await sql("update rate_limit set count=60 where key='ask-ai:instance'");
    const instance = await post(question("Only checking the board limit"));
    assert.equal(instance.status(), 429);
    assert.equal((await instance.json()).error, "AI_BUSY");
    await sql("delete from rate_limit where key like 'ask-ai:%'");

    const daily =
      "key='ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')";
    const prior = await sql("select count from rate_limit where " + daily);
    try {
      await sql("update rate_limit set count=5000 where " + daily);
      const exhausted = await post(question("Only checking the daily limit"));
      assert.equal(exhausted.status(), 429);
      assert.equal((await exhausted.json()).error, "AI_PAUSED");
      assert(Number(exhausted.headers()["retry-after"]) > 0);
    } finally {
      assert.match(prior, /^\d+$/);
      await sql("update rate_limit set count=" + prior + " where " + daily);
    }
    await eventually(usage, (value) => value === "7/5/0.048", 4000);
    const logs = await providerLogs();
    for (const status of failures) {
      assert.equal(logs.split("P12 Ask mapped status " + status).length - 1, 1);
    }
    assert.equal(logs.split("P12 Ask reflected stream error").length - 1, 1);
    return {
      maximum,
      usage: { calls: 7, errors: 5, usd: 0.048 },
      streaming: "gated, cited, and private error text withheld",
    };
  } finally {
    await sql("delete from feedback where title like 'P12 corpus fixture %'");
    await sql("delete from rate_limit where key like 'ask-ai:%'");
  }
}
