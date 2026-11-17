import { setTimeout as pause } from "node:timers/promises";
import { json, privateMarker, type Handler } from "../mock-llm";

export const failureText = "P12 private provider failure";

type TextPart = {
  type: string;
  text?: string;
  cache_control?: { type?: string };
};
type Message = { role: string; content: string | TextPart[] };

// Used by the one isolated provider in the production-image suite.
export const answerAskAi: Handler = async ({ body, response }) => {
  const messages = body.messages as Message[];
  const textOf = (message: Message) =>
    typeof message.content === "string"
      ? message.content
      : message.content.map((part) => part.text ?? "").join("");
  const question = textOf(messages.at(-1)!);
  const corpus = messages[1];
  const records = corpus && Array.isArray(corpus.content) ? textOf(corpus) : "";
  const history = messages.slice(records ? 2 : 1, -1);
  const expectedPolicy = body.provider as {
    data_collection?: string;
    zdr?: boolean;
  };
  if (
    !Array.isArray(corpus?.content) ||
    corpus.content[0]?.cache_control?.type !== "ephemeral" ||
    body.feedbackland_cache !== undefined ||
    body.max_tokens !== 4096 ||
    expectedPolicy?.data_collection !== "deny" ||
    history.length > 8 ||
    history.some(
      (turn) =>
        !["user", "assistant"].includes(turn.role) ||
        Buffer.byteLength(textOf(turn)) > 4000,
    ) ||
    history.reduce((size, turn) => size + Buffer.byteLength(textOf(turn)), 0) >
      16000 ||
    messages.reduce(
      (size, message) => size + Buffer.byteLength(textOf(message)),
      0,
    ) > 128000 ||
    records.split("\n").length > 300
  ) {
    console.log("P12 Ask transport shape rejected");
    return json(response, { error: {} }, 422);
  }
  if (question.startsWith(failureText)) {
    const status = Number(question.split(" ").at(-1));
    if ([401, 402, 429, 500].includes(status)) {
      console.log("P12 Ask mapped status " + status);
      return json(
        response,
        {
          error: {
            message: privateMarker,
            metadata: {
              arbitrary: privateMarker,
              ...(status === 402 && { limit_source: "openrouter_credits" }),
            },
          },
        },
        status,
      );
    }
  }
  const citation = /[0-9a-f-]{36}/.exec(records)?.[0];
  if (!citation) return json(response, { error: {} }, 422);
  const frame = (text: string | null, finish: string | null) => ({
    id: "p12-fixture-chat",
    created: 1,
    model: "fixture",
    object: "chat.completion.chunk",
    choices: [
      {
        index: 0,
        delta: text === null ? {} : { content: text },
        finish_reason: finish,
      },
    ],
  });
  response.writeHead(200, { "content-type": "text/event-stream" });
  const send = (value: unknown) =>
    response.write("data: " + JSON.stringify(value) + "\n\n");
  send(frame("Feedbackland fixture response. ", null));
  await pause(100);
  if (question === "P12 interrupted answer") {
    console.log("P12 Ask reflected stream error");
    send({
      error: {
        code: 502,
        message: privateMarker,
        metadata: { private: privateMarker },
      },
    });
  } else {
    send(frame("[Source post](post:" + citation + ")", null));
    send(frame(null, "stop"));
    send({
      choices: [],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 24,
        total_tokens: 124,
        cost: 0.024,
      },
    });
    console.log(
      JSON.stringify({
        askTextBytes: messages.reduce(
          (size, msg) => size + Buffer.byteLength(textOf(msg)),
          0,
        ),
        historyBytes: history.reduce(
          (size, msg) => size + Buffer.byteLength(textOf(msg)),
          0,
        ),
        corpusRows: records.split("\n").length,
        historyRows: history.length,
        cache: "part",
      }),
    );
  }
  response.end("data: [DONE]\n\n");
};
