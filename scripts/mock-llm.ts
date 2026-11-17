import { createServer } from "node:https";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { TLSSocket } from "node:tls";
import { once } from "node:events";

export const privateMarker = "P07_PRIVATE_REFLECTED_DATA";
export const firstKey = "P07_PRIVATE_FIRST_KEY_1111";
export const secondKey = "P07_PRIVATE_SECOND_KEY_1111";
type Wire = {
  url: string;
  method: string;
  body: Record<string, unknown>;
  response: ServerResponse;
};
export type Handler = (wire: Wire) => void | Promise<void>;
export function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}
export function chat(
  res: ServerResponse,
  cost: number | string | null = 0.001,
  finish = "stop",
  content = "fixture answer",
) {
  json(res, {
    id: "fixture-chat",
    model: "fixture",
    created: 1,
    object: "chat.completion",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: finish,
      },
    ],
    usage: {
      prompt_tokens: 9,
      completion_tokens: 3,
      total_tokens: 12,
      ...(cost === null ? {} : { cost }),
    },
  });
}
export function stream(res: ServerResponse) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  const send = (data: unknown) =>
    res.write("data: " + JSON.stringify(data) + "\n\n");
  send({
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: "hello " },
        finish_reason: null,
      },
    ],
  });
  send({
    choices: [{ index: 0, delta: { content: "board" }, finish_reason: "stop" }],
  });
  send({
    choices: [],
    usage: {
      prompt_tokens: 13,
      completion_tokens: 2,
      total_tokens: 15,
      cost: 0.042,
    },
  });
  res.end("data: [DONE]\n\n");
}
const success: Handler = ({ url, body, response }) => {
  if (url === "/api/v1/chat/completions") {
    if (body.stream) stream(response);
    else if (JSON.stringify(body.messages).includes("Moderate fixture"))
      chat(
        response,
        0.001,
        "stop",
        JSON.stringify({ isInappropriate: false, confidenceScore: 0.99 }),
      );
    else if (
      JSON.stringify(body.messages).includes("For this connection check")
    )
      chat(response, 0.001, "stop", '{"ok":true}');
    else chat(response);
    return;
  }
  if (url === "/api/v1/embeddings") {
    const input = body.input as string[];
    const size = Number(body.dimensions);
    json(response, {
      data: input
        .map((_, index) => ({ index, embedding: Array(size).fill(index + 1) }))
        .reverse(),
      model: "fixture",
      usage: { prompt_tokens: 17, total_tokens: 17, cost: 0.0000021 },
    });
    return;
  }
  if (url === "/api/v1/key") {
    json(response, {
      data: {
        limit: 20,
        limit_remaining: 12.5,
        usage: 7.5,
        is_free_tier: false,
        is_management_key: false,
      },
    });
    return;
  }
  json(response, {
    data: [
      {
        id: "fixture/model",
        pricing: { prompt: "0.001", completion: "0.002" },
        architecture: { input_modalities: ["text", "image"] },
        private: privateMarker,
      },
    ],
  });
};
export type MockOAuth = {
  authorize: (url: URL, res: ServerResponse) => void;
  exchange: (
    body: Record<string, unknown>,
    res: ServerResponse,
  ) => void | Promise<void>;
};
export async function mockOpenRouter(host = "127.0.0.1", oauth?: MockOAuth) {
  const fixture = {
    requests: 0,
    active: 0,
    last: {} as Omit<Wire, "response">,
    expectedKey: firstKey,
    handler: success,
    reset() {
      this.handler = success;
    },
  };
  let protocolFault = false;
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "",
      method = req.method ?? "";
    const authorization =
      !!oauth && method === "GET" && url.startsWith("/auth?");
    const exchange =
      !!oauth && method === "POST" && url === "/api/v1/auth/keys";
    if (
      (req.socket as TLSSocket).servername !== "openrouter.ai" ||
      req.headers.host !== "openrouter.ai" ||
      (authorization || exchange
        ? req.headers.authorization !== undefined
        : req.headers.authorization !== "Bearer " + fixture.expectedKey) ||
      [
        "http-referer",
        "x-openrouter-title",
        "x-title",
        "x-openrouter-categories",
        "x-openrouter-app-visibility",
      ].some((h) => req.headers[h] !== undefined)
    ) {
      protocolFault = true;
      json(res, {}, 403);
      return;
    }
    if (authorization) {
      oauth!.authorize(new URL(url, "https://openrouter.ai"), res);
      return;
    }
    const post = ["/api/v1/chat/completions", "/api/v1/embeddings"].includes(
      url,
    );
    const get = [
      "/api/v1/key",
      "/api/v1/models/user",
      "/api/v1/models/user?output_modalities=embeddings",
    ].includes(url);
    if (!(
      exchange ||
      (post && method === "POST") ||
      (get && method === "GET")
    )) {
      protocolFault = true;
      json(res, {}, 404);
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body =
      post || exchange
        ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
        : {};
    if (exchange) {
      await oauth!.exchange(body, res);
      return;
    }
    const handler = fixture.handler;
    fixture.last = { url, method, body };
    fixture.requests++;
    fixture.active++;
    res.on("close", () => {
      fixture.active--;
    });
    await handler({ ...fixture.last, response: res });
  };
  const server = createServer(
    {
      key: await readFile("/certs/provider.key"),
      cert: await readFile("/certs/provider.crt"),
    },
    (req, res) => {
      void handle(req, res).catch(() => {
        protocolFault = true;
        res.destroy();
      });
    },
  );
  server.listen(443, host);
  await once(server, "listening");
  return Object.assign(fixture, {
    close: async () => {
      const closed = once(server, "close");
      server.close();
      server.closeAllConnections();
      await closed;
      if (protocolFault) throw new Error("Invalid provider wire contract");
    },
  });
}
