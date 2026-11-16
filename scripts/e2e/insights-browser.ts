import assert from "node:assert/strict";
import { chromium } from "playwright";
import { fixturePassword } from "./setup-browser";
import { eventually, toolEnvironment } from "./run";
import { privateMarker } from "../mock-llm";

export async function insightsBrowser(
  a: string,
  b: string,
  project: string,
  docker: (...args: string[]) => Promise<string>,
) {
  assert.match(a, /^http:\/\/localhost:\d+$/);
  assert.match(b, /^http:\/\/localhost:\d+$/);
  assert.match(project, /^p07-\d+-[a-f0-9]+-ai$/);
  const query = async (statement: string) =>
    (
      await docker(
        "exec",
        project + "-pg",
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        "board_content",
        "-Atqc",
        statement,
      )
    ).trim();
  const provider = project + "-provider";
  await query("delete from rate_limit where key like 'ai:instance:day:%'");
  await query(`insert into feedback(title,description,"plainText",status,"moderationState","embeddingSkipped")
    values('P10 held analysis fixture','Body','Frozen fixture body','planned','screened',true)`);
  const browser = await chromium.launch({
    env: toolEnvironment() as Record<string, string>,
  });
  try {
    const context = await browser.newContext(),
      page = await context.newPage();
    const login = await context.request.post(a + "/api/auth/sign-in/email", {
      headers: { origin: a },
      data: { email: "admin@fixture.invalid", password: fixturePassword },
    });
    assert.equal(login.status(), 200);
    await page.goto(a + "/admin/insights");
    await page
      .getByRole("button", { name: "Generate insights", exact: true })
      .click();
    await page
      .getByText("Analysing feedback in the background.", { exact: false })
      .waitFor();
    await eventually(
      () => docker("logs", provider),
      (logs) => logs.includes("Insight fixture holding the first chunk"),
    );
    const join = await context.request.post(b + "/api/trpc/startInsightsRun", {
      headers: { origin: b },
      data: { json: null },
    });
    assert.equal(join.status(), 200);
    const active = (await join.json()).result.data.json;
    assert.equal(active.status, "running");
    assert.equal(
      await query(
        "select count(*) from insight_reports where status='running'",
      ),
      "1",
    );
    await page.goto(b + "/admin/insights");
    await page
      .getByText("Analysing feedback in the background.", { exact: false })
      .waitFor();
    await docker("kill", "--signal=USR2", provider);
    const regenerate = page.getByRole("button", {
      name: "Regenerate",
      exact: true,
    });
    await regenerate.waitFor();
    const theme = page
      .getByText("Improve board navigation", { exact: true })
      .first();
    await theme.waitFor();
    await page
      .getByRole("button", { name: /show what this analysis did/i })
      .click();
    await page.getByText("Last analysis", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await query(
      "update feedback set title='P10 failed analysis fixture' where title='P10 held analysis fixture'",
    );
    await regenerate.click();
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "The AI provider could not complete the analysis." });
    await alert.waitFor();
    await theme.waitFor();
    assert(!(await page.locator("body").innerText()).includes(privateMarker));
    const status = await context.request.get(a + "/api/trpc/getInsightsRun");
    const failed = (await status.json()).result.data.json;
    assert.equal(failed.status, "failed");
    assert.equal(failed.error, "provider-error");
    assert.deepEqual(Object.keys(failed).sort(), Object.keys(active).sort());
    assert.equal(
      await query(
        "select count(*) from insight_reports where status='succeeded'",
      ),
      "1",
    );
    assert.equal(
      await query(
        'select count(*) from insight_reports where "inputSnapshot" is not null or "requestPlan" is not null',
      ),
      "0",
    );
    return {
      replicas: 2,
      retainedAfterNavigation: true,
      sanitizedFailure: true,
      previousReportVisible: true,
    };
  } finally {
    await browser.close();
  }
}
