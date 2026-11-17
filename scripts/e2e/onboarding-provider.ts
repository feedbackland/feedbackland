import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  chat,
  json,
  mockOpenRouter,
  privateMarker,
  type MockOAuth,
} from "../mock-llm";

export const fixtureKey = "sk-or-v1-" + "controlled_fixture_1111";
export async function onboardingProvider(host = "127.0.0.1") {
  const codes = new Map<string, string>();
  const state = {
    exchanges: 0,
    exchangeGate: undefined as Promise<void> | undefined,
    authorized: 0,
    chat: 0,
    embeddings: 0,
    mode: "paid",
  };
  const issue = (challenge: string) => {
    const code = randomBytes(16).toString("hex");
    codes.set(code, challenge);
    return code;
  };
  const oauth: MockOAuth = {
    authorize(url, res) {
      const challenge = url.searchParams.get("code_challenge")!;
      assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      assert(url.searchParams.get("key_label")?.startsWith("Feedbackland"));
      const code = issue(challenge),
        callback = url.searchParams.get("callback_url");
      state.authorized++;
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store",
      });
      if (callback) {
        const to = new URL(callback);
        assert(["localhost", "board.test"].includes(to.hostname));
        to.searchParams.set("code", code);
        to.searchParams.set("state", url.searchParams.get("state")!);
        res.end(
          '<a href="' + to.href.replaceAll("&", "&amp;") + '">Authorize</a>',
        );
      } else {
        assert.equal(url.searchParams.has("state"), false);
        res.end(
          "<button onclick=\"this.hidden=true;document.querySelector('output').hidden=false\">Authorize</button><output hidden>" +
            code +
            "</output>",
        );
      }
    },
    async exchange(body, res) {
      state.exchanges++;
      const code = String(body.code),
        challenge = codes.get(code);
      codes.delete(code);
      if (
        !challenge ||
        body.code_challenge_method !== "S256" ||
        createHash("sha256")
          .update(String(body.code_verifier))
          .digest("base64url") !== challenge
      ) {
        json(res, {}, 400);
        return;
      }
      await state.exchangeGate;
      json(res, { key: fixtureKey, private: privateMarker });
    },
  };
  const mock = await mockOpenRouter(host, oauth),
    defaults = mock.handler;
  mock.expectedKey = fixtureKey;
  mock.handler = (wire) => {
    const { url, body, response } = wire;
    if (
      url.endsWith("/key") &&
      ["management", "expired", "limit", "invalid", "credit"].includes(
        state.mode,
      )
    ) {
      if (state.mode === "invalid")
        return json(response, { error: { message: privateMarker } }, 401);
      return json(response, {
        data: {
          usage: 1,
          limit: 10,
          limit_remaining: state.mode === "limit" ? 0 : 9,
          is_free_tier: state.mode === "credit",
          is_management_key: state.mode === "management",
          expires_at: state.mode === "expired" ? "2000-01-01T00:00:00Z" : null,
        },
      });
    }
    if (url.endsWith("/chat/completions")) {
      state.chat++;
      if (state.mode === "credit")
        return json(
          response,
          {
            error: {
              message: privateMarker,
              metadata: { limit_source: "openrouter_credits" },
            },
          },
          402,
        );
      if (state.mode === "unknown-model")
        return json(response, { error: { message: privateMarker } }, 404);
      if (state.mode === "rate")
        return json(response, { error: { message: privateMarker } }, 429);
      if (state.mode === "malformed")
        return chat(response, 0.001, "stop", "wrong shape");
      return chat(
        response,
        0.001,
        "stop",
        JSON.stringify({
          ok: true,
          isInappropriate: false,
          confidenceScore: 1,
        }),
      );
    }
    if (url.endsWith("/embeddings")) {
      state.embeddings++;
      if (state.mode === "width")
        return json(response, {
          data: (body.input as string[]).map((_, index) => ({
            index,
            embedding: [1, 1],
          })),
          model: "fixture",
          usage: { prompt_tokens: 1, total_tokens: 1 },
        });
    }
    return defaults(wire);
  };
  return { mock, state, issue };
}
if (process.argv.includes("--serve"))
  void onboardingProvider("0.0.0.0").then(({ state }) => {
    process.on("SIGUSR1", () => {
      state.mode = "credit";
      console.log("Fixture credit pending");
    });
    process.on("SIGUSR2", () => {
      state.mode = "paid";
      console.log("Fixture credit available");
    });
    console.log("Onboarding fixture listening");
  });
