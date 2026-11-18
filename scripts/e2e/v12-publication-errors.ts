import assert from "node:assert/strict";
import type { Page } from "playwright";
import { privateMarker, reflectionMarkers } from "../mock-llm";
import { eventually } from "./run";

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
  const signed = await page.request.get(base + "/api/auth/get-session");
  assert.equal(signed.status(), 200);
  const actor = (await signed.json()).user.id;
  const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  const scoped = (name: string, data: unknown) =>
    page.request.post(base + "/api/trpc/" + name, {
      headers: { origin: base },
      data: { json: data },
      timeout: 55_000,
    });
  const commands = [
    "anonymous post",
    "signed comment",
    "post edit",
    "comment edit",
  ];
  const coverage = async () => {
    await page.goto(base + "/admin/system");
    const section = page.locator("section").filter({
      has: page.getByRole("heading", {
        name: "Moderation coverage",
        exact: true,
      }),
    });
    const counter = section.locator("dd").first();
    await counter.waitFor();
    const raw = await counter.innerText();
    return Number(raw.replace(/[^0-9]/g, ""));
  };
  const accepted: { id: string; kind: string }[] = [];
  const baseline = await coverage();
  try {
    for (const [name, reason] of cases) {
      const input = token + name;
      const [anchor, edited, reply] = (
        await sql(
          'with a as (insert into feedback(title,description,"plainText","authorId","moderationState") values (' +
            [
              quote(token + "anchor " + name),
              "'Seeded description'",
              "'Seeded description'",
              quote(actor),
              "'screened'",
            ].join(",") +
            ') returning id), p as (insert into feedback(title,description,"plainText","authorId","moderationState") values (' +
            [
              quote(token + "seed post " + name),
              "'Seeded description'",
              "'Seeded description'",
              quote(actor),
              "'screened'",
            ].join(",") +
            ') returning id), c as (insert into comment("postId",content,"plainText","authorId","moderationState") ' +
            "select a.id,'Seeded comment','Seeded comment'," +
            quote(actor) +
            ",'screened' from a returning id) " +
            "select a.id || '/' || p.id || '/' || c.id from a,p,c",
        )
      ).split("/");
      for (const id of [anchor, edited, reply])
        assert.match(id, /^[0-9a-f-]{36}$/);
      const [post, ...other] = await Promise.all([
        fetch(base + "/api/feedback/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ description: input + " new post" }),
          signal: AbortSignal.timeout(55_000),
        }),
        scoped("createComment", {
          postId: anchor,
          parentCommentId: null,
          content: input + " new comment",
        }),
        scoped("updateFeedbackPost", {
          postId: edited,
          expectedRevision: "1",
          title: input + " revised title",
          description: input + " revised post",
        }),
        scoped("updateComment", {
          commentId: reply,
          expectedRevision: "1",
          content: input + " revised comment",
        }),
      ]);
      const responses = [
        { status: post.status, body: await post.text() },
        ...(await Promise.all(
          other.map(async (result) => ({
            status: result.status(),
            body: await result.text(),
          })),
        )),
      ];
      for (const [i, response] of responses.entries()) {
        assert(
          ![privateMarker, ...reflectionMarkers].some((marker) =>
            response.body.includes(marker),
          ),
          "provider text in publication response",
        );
        const result = JSON.parse(response.body);
        const label = name + " " + commands[i];
        if (reason) {
          assert.equal(response.status, i === 0 ? 201 : 200, label);
          const id = i === 0 ? result.id : result.result.data.json.id;
          assert.match(id, /^[0-9a-f-]{36}$/);
          const kind = i % 2 === 0 ? "feedback" : "comment";
          const eventId = kind === "feedback" ? "postId" : "commentId";
          assert.equal(
            await sql(
              "select f.\"moderationState\"||'/'||m.reason||'/'||f.revision from " +
                kind +
                ' f join moderation_event m on m."' +
                eventId +
                '"=f.id ' +
                "where f.id='" +
                id +
                '\' and f.revision=m."contentRevision"',
            ),
            "unscreened/" + reason + "/" + (i >= 2 ? "2" : "1"),
            label,
          );
          accepted.push({ id, kind });
        } else {
          assert.equal(response.status, 400, label);
          assert.equal(
            i === 0 ? result.error : result.error.json.message,
            "inappropriate-content",
          );
        }
      }
      assert.equal(
        await sql(
          'select count(*) from moderation_event where ("postId"=\'' +
            edited +
            "' or \"commentId\"='" +
            reply +
            "')",
        ),
        reason ? "2" : "0",
      );
    }
    assert.equal(await coverage(), baseline + accepted.length);
    await page.goto(base + "/admin/activity");
    await page.getByRole("button", { name: "Show unscreened items" }).click();
    const status = page.getByText(/Unscreened · provider error/).first();
    await status.waitFor();
    await eventually(
      async () => {
        const headings = page.getByRole("heading", { name: new RegExp(token) });
        if (await headings.count())
          await headings.last().evaluate((element) => {
            element.scrollIntoView({ block: "end" });
            for (
              let parent = element.parentElement;
              parent;
              parent = parent.parentElement
            )
              if (parent.clientHeight < parent.scrollHeight)
                parent.scrollTop = parent.scrollHeight;
            window.scrollTo(0, document.body.scrollHeight);
          });
        const body = await page.locator("body").innerText();
        return ["401", "402", "429", "500", "malformed", "timeout"].every(
          (code) =>
            [
              "new post",
              "revised title",
              "new comment",
              "revised comment",
            ].every((suffix) => body.includes(token + code + " " + suffix)),
        );
      },
      Boolean,
      25_000,
    );
    const summary = await logs();
    for (const [name] of cases)
      assert.equal(
        summary.split("P12 publication scenario " + name).length - 1,
        4,
        name,
      );
    return {
      accepted: accepted.length,
      refused: 8,
      operations: commands,
      callsPerCase: 4,
      coverageDelta: accepted.length,
    };
  } finally {
    await sql(
      "delete from feedback where title like " +
        quote(token + "%") +
        ' or "plainText" like ' +
        quote(token + "%"),
    );
  }
}
