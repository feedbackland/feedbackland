import { readFileSync } from "node:fs";
import { connectionChat } from "../../lib/ai-request-limits";
import { insightAnswer } from "./insights-fixture";
import { answerAskAi } from "./ask-ai-provider";
import { publicationFixture } from "./v12-publication-errors";
import {
  chat,
  json,
  mockOpenRouter,
  privateMarker,
  reflectionMarkers,
  reflectedProviderError,
} from "../mock-llm";

async function main() {
  if (process.env.P09_COLD_OUTAGE === "1") {
    // Keep the fixture address on the internal network without opening its TLS port.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Provider startup was never requested")),
        300_000,
      );
      process.once("SIGHUP", () => {
        clearTimeout(timeout);
        resolve();
      });
      console.log("Content fixture waiting to listen");
    });
  }
  const fixture = await mockOpenRouter("0.0.0.0");
  const defaults = fixture.handler;
  const releaseVision = Promise.withResolvers<void>();
  process.on("SIGUSR2", releaseVision.resolve);
  const insightRelease = Promise.withResolvers<void>();
  process.on("SIGUSR2", () => {
    if (insightWaiting) insightRelease.resolve();
  });
  let insightWaiting = false;
  let visionCalls = 0;
  let embeddingsOffline = false;
  let fixtureWidth = Number(process.env.P12_FIXTURE_WIDTH ?? 0);
  const calibrationVectors: { text: string; query: number[] }[] =
    process.env.P12_CALIBRATION_FIXTURE === "1"
      ? JSON.parse(readFileSync("/p12-calibration.json", "utf8"))
      : [];
  process.on("SIGUSR1", () => {
    fixtureWidth = 0;
    console.log("Fixture width released");
  });
  process.on("SIGHUP", () => {
    embeddingsOffline = !embeddingsOffline;
    console.log("Embedding fixture offline " + embeddingsOffline);
  });
  fixture.handler = async (request) => {
    if (request.url === "/api/v1/embeddings") {
      if (fixtureWidth || calibrationVectors.length) {
        const input = request.body.input as string[];
        const width = fixtureWidth || Number(request.body.dimensions);
        return json(request.response, {
          model: request.body.model,
          data: input.map((text, index) => ({
            index,
            embedding:
              calibrationVectors.find((pair) => pair.text === text)?.query ??
              Array(width).fill(1),
          })),
          usage: { prompt_tokens: 17, total_tokens: 17, cost: 0.0000021 },
        });
      }
      console.log("Embedding fixture width " + Number(request.body.dimensions));
      if (embeddingsOffline)
        return json(request.response, reflectedProviderError, 503);
    }
    if (request.url !== "/api/v1/chat/completions") return defaults(request);
    if (request.body.stream === true) return answerAskAi(request);
    const messages = request.body.messages as { content: unknown }[];
    const prompt = String(messages[0].content);
    const input = JSON.stringify(messages.slice(1));
    if (prompt === connectionChat.system && input.includes(connectionChat.text))
      return chat(
        request.response,
        0.001,
        "stop",
        JSON.stringify({ ok: true }),
      );
    if (
      prompt.startsWith("Group related feedback") ||
      prompt.startsWith("Find summaries")
    ) {
      if (input.includes("P10 failed analysis fixture"))
        return json(request.response, reflectedProviderError, 503);
      if (input.includes("P10 held analysis fixture")) {
        insightWaiting = true;
        console.log("Insight fixture holding the first chunk");
        await insightRelease.promise;
      }
      return insightAnswer(request);
    }
    if (prompt.startsWith("Moderate")) {
      const scenario = input.match(
        new RegExp(
          publicationFixture +
            "(401|402|429|500|timeout|malformed|refusal|filtered)",
        ),
      )?.[1];
      if (scenario) {
        console.log("P12 publication scenario " + scenario);
        if (scenario === "timeout") {
          await new Promise<void>((resolve) =>
            request.response.once("close", resolve),
          );
          return;
        }
        if (scenario === "malformed") {
          request.response.writeHead(200, {
            "content-type": "application/json",
          });
          request.response.end("{" + reflectedProviderError.error.message);
          return;
        }
        if (scenario === "filtered")
          return chat(request.response, null, "content_filter", privateMarker);
        return json(
          request.response,
          {
            error: {
              message: reflectedProviderError.error.message,
              metadata: {
                arbitrary: reflectionMarkers,
                ...(scenario === "402" && {
                  limit_source: "openrouter_credits",
                }),
                ...(scenario === "refusal" && {
                  error_type: "content_policy_violation",
                }),
              },
            },
          },
          scenario === "refusal" ? 403 : Number(scenario),
        );
      }
      if (
        input.includes("data:image/png;") &&
        input.includes("Image attachment")
      ) {
        console.log("Production vision fixture entered " + ++visionCalls);
        request.response.once("close", () =>
          console.log("Production vision fixture closed"),
        );
        await releaseVision.promise;
        if (request.response.destroyed) return;
      }
      if (input.includes("Offline fixture"))
        return json(
          request.response,
          { error: { message: privateMarker } },
          429,
        );
      return chat(
        request.response,
        0.001,
        "stop",
        JSON.stringify({
          isInappropriate: input.includes("Refusal fixture"),
          confidenceScore: 0.98,
          titleApproved: true,
        }),
      );
    }
    if (prompt.startsWith("Create"))
      return chat(
        request.response,
        0.001,
        "stop",
        JSON.stringify({ title: "Published fixture idea", category: "idea" }),
      );
    if (
      prompt.startsWith("Improve") &&
      input.includes("Fixture rewrite unavailable")
    )
      return json(request.response, reflectedProviderError, 503);
    if (
      !prompt.startsWith("Improve") ||
      input.includes("/api/images/") ||
      input.includes("data:image/")
    )
      return json(request.response, { error: {} }, 400);
    return chat(
      request.response,
      0.001,
      "stop",
      "Clearer <b>fixture</b> & detail.",
    );
  };
  console.log("Content fixture ready");
}
main().catch(() => {
  console.error("Content fixture startup failed");
  process.exitCode = 1;
});
