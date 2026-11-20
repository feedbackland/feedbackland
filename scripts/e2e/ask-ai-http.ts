import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import type { Page } from "playwright";
import { failureText } from "./ask-ai-provider";
import { privateMarker, reflectionMarkers } from "../mock-llm";
import { eventually } from "./run";
import { signIn } from "./v3-auth";
import { ASK_AI_SESSION_HEADER } from "../../lib/ask-ai";

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
    assert(
      ![privateMarker, ...reflectionMarkers].some((marker) =>
        text.includes(marker),
      ),
      "provider text in Ask AI response",
    );
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

  const seeded = await sql(
    "insert into feedback(title,description,\"plainText\",\"moderationState\") values ('P12 cited result','A cited source','A cited source','disabled') returning id",
  );
  assert.match(seeded, /^[0-9a-f-]{36}$/);
  await page.goto(origin + "/admin/ask-ai");
  const input = page.getByPlaceholder("Ask about your feedback\u2026");
  await input.fill("🧪".repeat(1001));
  await page
    .getByText("Shorten your question to 4,000 UTF-8 bytes or fewer.")
    .waitFor();
  assert(
    await page.getByRole("button", { name: "Send", exact: true }).isDisabled(),
  );
  await input.press("Enter");
  assert.equal(await usage(), "0/0/0");
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
  // The rendered text and citation prove the browser consumed the stream.
  // Read raw SSE in the API client below, independent of the browser debugger.
  await page.getByText(/Feedbackland fixture response/).waitFor();
  const cited = page.getByRole("link", {
    name: "Source 1: P12 cited result",
    exact: true,
  });
  await cited.waitFor();
  const target = new URL((await cited.getAttribute("href"))!, origin);
  assert.equal(target.origin, origin);
  assert.equal(target.pathname, "/" + seeded);
  await page.getByText(/posts? supplied for this answer/).waitFor();
  await eventually(usage, (value) => value === "1/0/0.024", 5000);

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
    const sse = await secretFree(request);
    for (const kind of ["text-start", "text-delta", "text-end", "finish"])
      assert(sse.includes('"type":"' + kind + '"'), kind);
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
            completeDescription: boolean;
            cache: string;
          },
      );
    const maximum = samples.at(-1);
    assert(maximum);
    assert(maximum.askTextBytes > 126000 && maximum.askTextBytes <= 128000);
    assert(maximum.completeDescription);
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
      await sql("update rate_limit set count=4000 where " + daily);
      const exhausted = await post(question("Only checking the daily limit"));
      assert.equal(exhausted.status(), 429);
      assert.equal((await exhausted.json()).error, "AI_PAUSED");
      assert(Number(exhausted.headers()["retry-after"]) > 0);
    } finally {
      assert.match(prior, /^\d+$/);
      await sql("update rate_limit set count=" + prior + " where " + daily);
    }
    await eventually(usage, (value) => value === "7/5/0.048", 4000);
    const timing = await lifecycle(page, origin, sql, providerLogs, cookies);
    await accountSwitch(page, origin, sql, async (sessionId) => {
      const stale = await post(question("Stale browser session"), {
        [ASK_AI_SESSION_HEADER]: sessionId,
      });
      assert.equal(stale.status(), 403);
      assert.deepEqual(await stale.json(), { error: "FORBIDDEN" });
      assert.match(await usage(), /^14\/9\//);
    });
    const logs = await providerLogs();
    for (const status of failures) {
      assert.equal(logs.split("P12 Ask mapped status " + status).length - 1, 1);
    }
    assert.equal(logs.split("P12 Ask reflected stream error").length - 1, 1);
    return {
      maximum,
      initialUsage: { calls: 7, errors: 5, usd: 0.048 },
      lifecycle: timing,
      accountSwitch: "same tab, two administrators, stale dispatch rejected",
      streaming: "gated, cited, and private error text withheld",
    };
  } finally {
    await sql(
      "delete from feedback where id='" +
        seeded +
        "' or title like 'P12 corpus fixture %'",
    );
    await sql("delete from rate_limit where key like 'ask-ai:%'");
  }
}

async function lifecycle(
  page: Page,
  origin: string,
  sql: (statement: string) => Promise<string>,
  logs: () => Promise<string>,
  cookie: string,
) {
  const headers = { origin, cookie, "content-type": "application/json" };
  const send = (scenario: string, signal?: AbortSignal) =>
    fetch(origin + "/api/chat", {
      method: "POST",
      headers,
      signal: signal ?? AbortSignal.timeout(20_000),
      body: JSON.stringify(question("P12 lifecycle " + scenario)),
    });
  const log = (label: string) =>
    eventually(
      logs,
      (output) => output.includes("P12 Ask lifecycle " + label),
      8000,
    );
  const accounts = () =>
    sql(
      "select concat(sum(calls),'/',sum(errors)) from llm_usage where feature='ask-ai'",
    );
  for (const scenario of ["early", "late"]) {
    const stop = new AbortController();
    const incoming = send(scenario, stop.signal);
    const settled = incoming.catch(() => null);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      await log("entered " + scenario);
      if (scenario === "late") {
        const response = await incoming;
        assert.equal(response.status, 200);
        reader = response.body!.getReader();
        assert(!(await reader.read()).done);
      }
    } finally {
      stop.abort();
      await reader?.cancel().catch(() => {});
      await settled;
    }
    await log("closed " + scenario);
  }
  await eventually(accounts, (value) => value === "9/7", 8000);
  const empty = await send("empty");
  assert.equal(empty.status, 503);
  assert.deepEqual(await empty.json(), { error: "AI_UNAVAILABLE" });
  assert.equal(await accounts(), "10/8");
  const truncated = await send("truncated");
  assert.equal(truncated.status, 200);
  const raw = await truncated.text();
  assert(
    raw.includes('"finishReason":"length"') && raw.includes('"truncated":true'),
  );
  assert.equal(await accounts(), "11/8");

  const fixedDay = await sql(
    "select 'ai:instance:day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD')",
  );
  assert.match(fixedDay, /^ai:instance:day:\d{4}-\d{2}-\d{2}$/);
  const original = await sql(
    "select count from rate_limit where key='" + fixedDay + "'",
  );
  assert.match(original, /^\d+$/);
  try {
    await sql("update rate_limit set count=3999 where key='" + fixedDay + "'");
    const lastOrdinary = await send("truncated");
    assert.equal(lastOrdinary.status, 200);
    await lastOrdinary.text();
    assert.equal(
      await sql("select count from rate_limit where key='" + fixedDay + "'"),
      "4000",
    );
    const refused = await send("truncated");
    assert.equal(refused.status, 429);
    assert.match((await refused.json()).resetsAt, /T00:00:00\.000Z$/);
    assert.equal(await accounts(), "12/8");
  } finally {
    await sql(
      "update rate_limit set count=" +
        original +
        " where key='" +
        fixedDay +
        "'",
    );
  }
  await sql("delete from rate_limit where key like 'ask-ai:%'");
  // The flow uses real transport and continues to receive text under its idle
  // timeout. The absolute window must still terminate the paid call.
  const before = performance.now();
  const wall = await send("wall", AbortSignal.timeout(195_000));
  assert.equal(wall.status, 200);
  assert((await wall.text()).includes('"errorText":"AI_UNAVAILABLE"'));
  assert(
    performance.now() - before >= 175_000 &&
      performance.now() - before < 195_000,
  );
  await log("closed wall");
  await eventually(accounts, (value) => value === "13/9", 8000);
  await sql("delete from rate_limit where key like 'ask-ai:%'");
  await page.goto(origin + "/admin/ask-ai");
  await page
    .getByPlaceholder("Ask about your feedback…")
    .fill("P12 lifecycle truncated");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/The answer reached the model's output limit/).waitFor();
  await eventually(accounts, (value) => value === "14/9", 8000);
  // Verify the actual mounted message maps a structured HTTP failure and keeps
  // the submitted question available in the thread.
  await page.goto(origin + "/admin/ask-ai");
  const retryQuestion = "P12 question stays editable when the board is busy";
  const retryBodies: unknown[] = [];
  await page.route("**/api/chat", (route) => {
    const sent = route.request().postDataJSON();
    retryBodies.push(sent.messages?.at(-1)?.parts[0]?.text);
    return route.fulfill({
      status: 429,
      json:
        retryBodies.length === 1
          ? { error: "AI_BUSY" }
          : { error: "AI_PAUSED", resetsAt: "2030-04-28T00:00:00.000Z" },
    });
  });
  try {
    await page
      .getByPlaceholder("Ask about your feedback\u2026")
      .fill(retryQuestion);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByText("Ask AI is busy. Try again shortly.").waitFor();
    await page.getByText(retryQuestion, { exact: true }).waitFor();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByText(/^Paused until /).waitFor();
    await page
      .getByRole("link", { name: "Raise the daily limit", exact: true })
      .waitFor();
    assert.deepEqual(retryBodies, [retryQuestion, retryQuestion]);
  } finally {
    await page.unroute("**/api/chat");
  }
  return {
    earlyAndLateCancellation: true,
    blankError: true,
    truncation: true,
    exactOrdinaryCap: 4000,
    absoluteDeadline: true,
    dispatches: 14,
    errors: 9,
  };
}

async function accountSwitch(
  page: Page,
  origin: string,
  sql: (statement: string) => Promise<string>,
  stale: (sessionId: string) => Promise<void>,
) {
  const session = await page.request.get(origin + "/api/auth/get-session");
  const oldId = (await session.json()).session.id as string;
  assert(oldId);
  await page.reload();
  const original = "What happened on the board?";
  await page.getByText(original, { exact: true }).waitFor();
  const signOut = async () => {
    await page.goto(origin);
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  };
  await signOut();
  const key = "feedbackland-ask-ai:session";
  assert.equal(
    await page.evaluate((name) => sessionStorage.getItem(name) === null, key),
    true,
  );
  const email = "p12-second-admin@fixture.invalid";
  await signIn(page, email, true);
  await sql("update \"user\" set role='admin' where email='" + email + "'");
  await page.goto(origin + "/admin/ask-ai");
  await page.getByPlaceholder("Ask about your feedback…").waitFor();
  assert.equal(await page.getByText(original, { exact: true }).count(), 0);
  assert.equal(
    await page.evaluate((name) => sessionStorage.getItem(name) === null, key),
    true,
  );
  await stale(oldId);
  await signOut();
  await signIn(page, "admin@fixture.invalid");
}
