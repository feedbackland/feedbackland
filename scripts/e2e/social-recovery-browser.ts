import assert from "node:assert/strict";
import type { Browser, BrowserContext, Page } from "playwright";
import type { Pool } from "pg";
import { eventually } from "./run";
import { fixturePassword } from "./setup-browser";

export async function passwordAccount(
  context: BrowserContext,
  base: string,
  email: string,
) {
  const response = await context.request.post(
    base + "/api/auth/sign-up/email",
    {
      headers: { origin: base, "sec-fetch-site": "same-origin" },
      data: { name: "Password visitor", email, password: fixturePassword },
    },
  );
  assert.equal(response.status(), 200, "Password fixture signup failed");
  return (await response.json()).user.id as string;
}
export async function resetForm(
  page: Page,
  url: string,
  password: string,
  replay = false,
) {
  await page.goto(url);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  if (replay)
    await page
      .getByRole("alert")
      .filter({ hasText: "could not be used" })
      .waitFor();
  else {
    await page
      .getByRole("status")
      .filter({ hasText: "Password reset. Sign in again" })
      .waitFor();
    assert.equal(new URL(page.url()).search, "");
  }
}
export async function recoverForm(
  page: Page,
  base: string,
  code: string,
  email: string,
  password: string,
  error = false,
) {
  await page.goto(base + "/recover");
  await page.getByLabel("Recovery code", { exact: true }).fill(code);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Review recovery", exact: true })
    .click();
  await page.getByRole("status").filter({ hasText: email }).waitFor();
  await page
    .getByRole("button", { name: "Confirm recovery", exact: true })
    .click();
  if (error)
    await page
      .getByRole("alert")
      .filter({ hasText: "Recovery could not be completed" })
      .waitFor();
  else {
    await page
      .getByRole("status")
      .filter({ hasText: "Administrator access restored" })
      .waitFor();
    await page.getByText("Remove RECOVERY_CODE", { exact: false }).waitFor();
  }
}
export async function mailContracts(
  browser: Browser,
  admin: BrowserContext,
  base: string,
  mailApi: string,
  pool: Pool,
) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const email = "mail-reset@fixture.invalid";
    const userId = await passwordAccount(context, base, email);
    const body = { redirectTo: "/reset-password", email };
    const responses = [];
    const visitor = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const forgot = await visitor.newPage();
      await forgot.goto(base);
      await forgot
        .getByRole("button", { name: "Sign in", exact: true })
        .click();
      await forgot
        .getByRole("button", { name: "Sign in with Email", exact: true })
        .click();
      await forgot
        .getByRole("button", { name: "Forgot password?", exact: true })
        .click();
      await forgot.getByLabel("Email", { exact: true }).fill(email);
      const result = forgot.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          "/api/auth/request-password-reset",
      );
      void result.catch(() => {});
      await forgot
        .getByRole("button", { name: "Send reset link", exact: true })
        .click();
      const response = await result;
      assert.equal(response.status(), 200);
      responses.push(await response.json());
      await forgot
        .getByRole("status")
        .filter({ hasText: "If this email exists" })
        .waitFor();
    } finally {
      await visitor.close();
    }
    for (const address of ["missing-mail@fixture.invalid"]) {
      const response = await context.request.post(
        base + "/api/auth/request-password-reset",
        {
          headers: {
            origin: base,
            "sec-fetch-site": "same-origin",
            "x-forwarded-host": "spoof.invalid",
            "x-forwarded-proto": "http",
          },
          data: { ...body, email: address },
        },
      );
      assert.equal(response.status(), 200);
      responses.push(await response.json());
    }
    assert.deepEqual(
      responses[0],
      responses[1],
      "Reset response enumerated account existence",
    );
    const listing = await eventually(
      async () => (await fetch(mailApi + "/api/v1/messages")).json(),
      (value) => value.total === 1,
    );
    const message = await (
      await fetch(mailApi + "/api/v1/message/" + listing.messages[0].ID)
    ).json();
    const resetUrl = new URL(
      (message.Text as string).match(/https:\/\/[^\s]+/)![0],
    );
    assert.equal(
      resetUrl.origin,
      base,
      "Spoofed host escaped the pinned reset origin",
    );
    assert.equal(
      new URL(resetUrl.searchParams.get("callbackURL")!, base).origin,
      base,
    );
    const page = await context.newPage();
    await resetForm(page, resetUrl.href, "Mail-reset-password-42");
    assert.equal(
      (
        await pool.query('select id from auth_session where "userId"=$1', [
          userId,
        ])
      ).rows.length,
      0,
    );
    const replay = await context.request.get(resetUrl.href);
    assert(
      new URL(replay.url()).searchParams.has("error"),
      "Consumed email link was reusable",
    );
    const known = await context.request.post(base + "/api/auth/sign-in/email", {
      headers: { origin: base },
      data: { email, password: "Mail-reset-password-42" },
    });
    assert.equal(known.status(), 200);
    const linkResponse = await admin.request.post(
      base + "/api/trpc/createPasswordResetLink",
      {
        headers: { origin: base, "sec-fetch-site": "same-origin" },
        data: { json: { email } },
      },
    );
    assert.equal(linkResponse.status(), 200);
    const link = (await linkResponse.json()).result.data.json.url as string;
    assert.equal(new URL(link).origin, base);
    await resetForm(page, link, "Admin-reset-password-42");
    await resetForm(page, link, "Replay-must-fail-42", true);
    await page.goto(base + "/reset-password");
    await page
      .getByRole("alert")
      .filter({
        hasText:
          "This password reset link is invalid, expired or already used.",
      })
      .waitFor();
    assert.equal(
      (await (await fetch(mailApi + "/api/v1/messages")).json()).total,
      1,
      "Admin token capture leaked an email",
    );
    return {
      knownUnknownIdentical: true,
      delivered: 1,
      pinnedOrigin: true,
      emailReset: true,
      adminReset: true,
      singleUse: true,
      sessionsRevoked: true,
    };
  } finally {
    await context.close();
  }
}
