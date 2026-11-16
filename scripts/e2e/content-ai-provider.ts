import { chat, json, mockOpenRouter, privateMarker } from "../mock-llm";

async function main() {
  const fixture = await mockOpenRouter("0.0.0.0");
  const defaults = fixture.handler;
  const releaseVision = Promise.withResolvers<void>();
  process.on("SIGUSR2", releaseVision.resolve);
  let visionCalls = 0;
  let coldOutage = process.env.P09_COLD_OUTAGE === "1";
  let embeddingsOffline = coldOutage;
  process.on("SIGHUP", () => {
    coldOutage = false;
    embeddingsOffline = !embeddingsOffline;
    console.log("Embedding fixture offline " + embeddingsOffline);
  });
  fixture.handler = async (request) => {
    if (request.url === "/api/v1/embeddings") {
      console.log("Embedding fixture width " + Number(request.body.dimensions));
      if (embeddingsOffline) return json(request.response, { error: {} }, 503);
    }
    if (coldOutage) return json(request.response, { error: {} }, 503);
    if (request.url !== "/api/v1/chat/completions") return defaults(request);
    const messages = request.body.messages as { content: unknown }[];
    const prompt = String(messages[0].content);
    const input = JSON.stringify(messages.slice(1));
    if (prompt.startsWith("Moderate")) {
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
      return json(request.response, { error: {} }, 503);
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
