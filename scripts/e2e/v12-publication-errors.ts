import assert from "node:assert/strict";
import type { Page } from "playwright";
import { privateMarker } from "../mock-llm";

export const publicationFixture = "P12 fixture publication ";

export async function publicationErrors(
  page: Page,
  base: string,
  sql: (statement: string) => Promise<string>,
  logs: () => Promise<string>,
) {
  const token = publicationFixture;
  const cases = [
    ["401", "provider-auth"],
    ["402", "provider-credit"],
    ["429", "provider-rate"],
    ["500", "provider-error"],
    ["malformed", "provider-error"],
    ["timeout", "provider-error"],
    ["refusal", null],
    ["filtered", null],
  ] as const;
  const accepted: string[] = [];
  try {
    for (const [name, reason] of cases) {
      const response = await fetch(base + "/api/feedback/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: token + name }),
        signal: AbortSignal.timeout(45000),
      });
      const value = await response.text();
      assert(
        !value.includes(privateMarker),
        "provider text in publication response",
      );
      const body = JSON.parse(value);
      if (reason) {
        assert.equal(response.status, 201, name);
        assert.match(body.id, /^[0-9a-f-]{36}$/);
        accepted.push(body.id);
        assert.equal(
          await sql(`select f."moderationState"||'/'||m.reason
          from feedback f join moderation_event m on m."postId"=f.id
          where f.id='${body.id}' and f.revision=m.revision`),
          "unscreened/" + reason,
          name,
        );
      } else {
        assert.equal(response.status, 400, name);
        assert.deepEqual(body, { error: "inappropriate-content" });
      }
    }
    await page.goto(base + "/admin/activity");
    const filter = page.getByRole("button", { name: "Show unscreened items" });
    await filter.click();
    for (const id of accepted)
      await page
        .locator('a[href="/' + id + '"]')
        .first()
        .waitFor();
    assert(!(await page.locator("body").innerText()).includes(privateMarker));
    const summary = await logs();
    for (const [name] of cases)
      assert.equal(
        summary.split("P12 publication scenario " + name).length - 1,
        1,
        name,
      );
    assert.equal(
      await sql(
        `select count(*) from feedback where "plainText" like '${token}%'`,
      ),
      String(accepted.length),
    );
    return {
      accepted: accepted.length,
      refused: cases.length - accepted.length,
      callsPerCase: 1,
      activity: "all accepted cases have mapped coverage",
    };
  } finally {
    await sql(`delete from feedback where "plainText" like '${token}%'`);
  }
}
