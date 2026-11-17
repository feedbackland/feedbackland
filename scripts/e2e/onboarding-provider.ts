import { createServer } from "node:http";
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
    balance: 12.5,
    limitReset: "monthly" as string | null,
    expiry: null as string | null,
    keyGate: undefined as Promise<void> | undefined,
    keyReads: 0,
    samples: [] as { at: number; kind: string; images: number }[],
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
  mock.handler = async (wire) => {
    const { url, body, response } = wire;
    if (url.endsWith("/key")) {
      state.keyReads++;
      await state.keyGate;
      if (state.mode === "invalid")
        return json(response, { error: { message: privateMarker } }, 401);
      return json(response, {
        data: {
          usage: 1,
          limit: 20,
          limit_remaining: state.mode === "limit" ? 0 : state.balance,
          limit_reset: state.limitReset,
          is_free_tier: state.mode === "credit",
          is_management_key: state.mode === "management",
          expires_at:
            state.mode === "expired" ? "2000-01-01T00:00:00Z" : state.expiry,
        },
      });
    }
    if (url.endsWith("/chat/completions")) {
      state.chat++;
      const messages = JSON.stringify(body.messages);
      const kind = messages.includes("For this connection check")
        ? "check"
        : messages.includes("Create a short")
          ? "title"
          : messages.includes("Improve this feedback draft")
            ? "rewrite"
            : "moderation";
      const images = (messages.match(/"type":"image_url"/g) ?? []).length;
      state.samples.push({ at: Date.now(), kind, images });
      if (state.samples.length > 1024) state.samples.shift();
      if (state.mode === "vision" && images) return json(response, {}, 400);
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
        kind === "title"
          ? JSON.stringify({
              title: "Fixture navigation proposal",
              category: "idea",
            })
          : kind === "rewrite"
            ? "Please improve board navigation."
            : kind === "check"
              ? '{"ok":true}'
              : JSON.stringify({
                  isInappropriate: false,
                  confidenceScore: 1,
                  titleApproved: true,
                }),
      );
    }
    if (url.endsWith("/embeddings")) {
      state.embeddings++;
      if (state.mode === "embedding-rate") return json(response, {}, 429);
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
  void onboardingProvider("0.0.0.0").then(({ state, mock }) => {
    // Only commands run inside the isolated provider container can reach this fixture control.
    createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "POST" && url.pathname === "/mode") {
        state.mode = url.searchParams.get("value") ?? "paid";
        const key = url.searchParams.get("rotation");
        mock.expectedKey = key === "second" ? fixtureKey + "2222" : fixtureKey;
        if (url.searchParams.has("balance"))
          state.balance = Number(url.searchParams.get("balance"));
        if (url.searchParams.has("expiry"))
          state.expiry = url.searchParams.get("expiry") || null;
      }
      json(res, { at: Date.now(), mode: state.mode, samples: state.samples });
    }).listen(8089, "127.0.0.1", () =>
      console.log("Onboarding fixture listening"),
    );
  });
