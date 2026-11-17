import { createServer as http, request } from "node:http";
import { createServer as https } from "node:https";
import { createServer, connect } from "node:net";
import { readFileSync } from "node:fs";
const tls = {
  key: readFileSync("/certs/provider.key"),
  cert: readFileSync("/certs/provider.crt"),
};
const relay = (protocol) => (incoming, outgoing) => {
  const url = new URL(incoming.url, "http://localhost");
  if (
    protocol === "http" &&
    url.pathname === "/fixture-parent" &&
    /^\d{1,5}$/.test(url.searchParams.get("port") ?? "")
  ) {
    outgoing.writeHead(200, {
      "content-type": "text/html",
      "cache-control": "no-store",
    });
    outgoing.end(
      '<!doctype html><html lang="en"><title>Separate host</title><iframe title="Feedback drawer" width="900" height="800" src="https://board.test:' +
        url.searchParams.get("port") +
        '/?embed=drawer"></iframe></html>',
    );
    return;
  }
  const host = (incoming.headers.host ?? "").split(":")[0];
  const server = host === "board.test" ? "public-board" : "board";
  const upstream = request(
    {
      host: server,
      port: 3000,
      path: incoming.url,
      method: incoming.method,
      headers: {
        ...incoming.headers,
        "x-forwarded-host": incoming.headers.host,
        "x-forwarded-proto": protocol,
      },
    },
    (res) => {
      outgoing.writeHead(res.statusCode, res.headers);
      res.pipe(outgoing);
    },
  );
  upstream.on("error", () => {
    if (!outgoing.headersSent) outgoing.writeHead(502);
    outgoing.end();
  });
  incoming.on("aborted", () => upstream.destroy());
  incoming.pipe(upstream);
};
http(relay("http")).listen(3001);
https(tls, relay("https")).listen(3000);
createServer((client) => {
  const peer = connect(443, "openrouter.ai");
  peer.on("error", () => client.destroy());
  client.on("error", () => peer.destroy());
  client.on("close", () => peer.destroy());
  peer.on("close", () => client.destroy());
  client.pipe(peer).pipe(client);
}).listen(3443);
