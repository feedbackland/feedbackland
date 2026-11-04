import { createServer } from "node:http";
import {
  createServer as createHttpsServer,
  type ServerOptions,
} from "node:https";
import { createHash, randomBytes } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export async function createOidcMock(tls?: ServerOptions) {
  const keys = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: "fixture-key",
    use: "sig",
    alg: "RS256",
  };
  const codes = new Map<
    string,
    { email: string; nonce: string; challenge: string; redirect: string }
  >();
  const access = new Map<string, { email: string; subject: string }>();
  const controls = {
    ready: false,
    coop: false,
    stall: false,
    badNonce: false,
    badIssuer: false,
    badAudience: false,
    badSignature: false,
    omitIdToken: false,
    omitExpiration: false,
    omitIssuedAt: false,
    badAuthorizedParty: false,
    emailInUserInfo: false,
    badUserInfoSubject: false,
    picture: "https://avatar.invalid/fixture.png",
    discoveries: 0,
    abortedDiscoveries: 0,
    tokenExchanges: 0,
    jwksRequests: 0,
    logoutRequests: 0,
  };
  let issuer = "";
  const server = (tls ? createHttpsServer.bind(null, tls) : createServer)(
    (request, response) => {
      if (controls.coop)
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
      response.setHeader("Cache-Control", "no-store");
      const run = async () => {
        const url = new URL(request.url!, issuer);
        if (url.pathname === "/.well-known/openid-configuration") {
          controls.discoveries++;
          if (controls.stall) {
            response.on("close", () => controls.abortedDiscoveries++);
            return;
          }
          if (!controls.ready) return void response.writeHead(503).end();
          return void response
            .writeHead(200, { "content-type": "application/json" })
            .end(
              JSON.stringify({
                issuer,
                authorization_endpoint: `${issuer}/authorize`,
                token_endpoint: `${issuer}/token`,
                userinfo_endpoint: `${issuer}/userinfo`,
                jwks_uri: `${issuer}/jwks`,
                end_session_endpoint: `${issuer}/logout`,
                response_types_supported: ["code"],
                subject_types_supported: ["public"],
                id_token_signing_alg_values_supported: ["RS256"],
                code_challenge_methods_supported: ["S256"],
              }),
            );
        }
        if (url.pathname === "/jwks") {
          controls.jwksRequests++;
          return void response
            .writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify({ keys: [jwk] }));
        }
        if (url.pathname === "/authorize") {
          if (
            url.searchParams.get("client_id") !== "fixture-client" ||
            url.searchParams.get("response_type") !== "code" ||
            url.searchParams.get("code_challenge_method") !== "S256" ||
            !url.searchParams.get("nonce") ||
            !url.searchParams.get("state")
          )
            return void response
              .writeHead(400)
              .end("Invalid authorization request");
          const hidden = Array.from(
            url.searchParams,
            ([key, value]) =>
              `<input type="hidden" name="${escape(key)}" value="${escape(value)}">`,
          ).join("");
          return void response
            .writeHead(200, { "content-type": "text/html" })
            .end(
              `<!doctype html><html><body><h1>Fixture identity provider</h1><form action="/approve">${hidden}<label>Email <input type="email" name="email" value="social@fixture.invalid" required></label><button name="decision" value="allow">Allow access</button><button name="decision" value="deny">Deny access</button><button name="decision" value="bad-state">Break state</button></form></body></html>`,
            );
        }
        if (url.pathname === "/approve") {
          const redirect = new URL(url.searchParams.get("redirect_uri")!);
          if (
            redirect.protocol !== "https:" ||
            redirect.hostname !== "localhost" ||
            redirect.pathname !== "/api/auth/callback/oidc"
          )
            return void response.writeHead(400).end();
          const decision = url.searchParams.get("decision");
          const state =
            decision === "bad-state"
              ? randomBytes(16).toString("hex")
              : url.searchParams.get("state")!;
          redirect.searchParams.set("state", state);
          if (decision === "deny")
            redirect.searchParams.set("error", "access_denied");
          else {
            const code = randomBytes(24).toString("hex");
            codes.set(code, {
              email: url.searchParams.get("email")!.toLowerCase(),
              nonce: url.searchParams.get("nonce")!,
              challenge: url.searchParams.get("code_challenge")!,
              redirect: url.searchParams.get("redirect_uri")!,
            });
            redirect.searchParams.set("code", code);
          }
          return void response
            .writeHead(302, { location: redirect.href })
            .end();
        }
        if (url.pathname === "/token" && request.method === "POST") {
          let body = "";
          for await (const part of request) {
            body += part;
            if (body.length > 16_384) return void response.writeHead(413).end();
          }
          const params = new URLSearchParams(body);
          const basic = request.headers.authorization?.startsWith("Basic ")
            ? Buffer.from(request.headers.authorization.slice(6), "base64")
                .toString("utf8")
                .split(":")
            : null;
          if (
            (params.get("client_id") ?? basic?.[0]) !== "fixture-client" ||
            (params.get("client_secret") ?? basic?.[1]) !== "fixture-secret"
          )
            return void response.writeHead(401).end();
          const code = params.get("code")!;
          const flow = codes.get(code);
          codes.delete(code);
          if (
            !flow ||
            params.get("redirect_uri") !== flow.redirect ||
            createHash("sha256")
              .update(params.get("code_verifier") ?? "")
              .digest("base64url") !== flow.challenge
          )
            return void response
              .writeHead(400, { "content-type": "application/json" })
              .end(JSON.stringify({ error: "invalid_grant" }));
          controls.tokenExchanges++;
          const subject = createHash("sha256").update(flow.email).digest("hex");
          let idToken = await new SignJWT({
            ...(!controls.omitExpiration
              ? { exp: Math.floor(Date.now() / 1000) + 300 }
              : {}),
            ...(!controls.omitIssuedAt
              ? { iat: Math.floor(Date.now() / 1000) }
              : {}),
            ...(controls.badAuthorizedParty ? { azp: "foreign-client" } : {}),
            ...(!controls.emailInUserInfo && !controls.badUserInfoSubject
              ? { email: flow.email }
              : {}),
            email_verified: true,
            name: "Provider visitor",
            picture: controls.picture,
            role: "admin",
            nonce: controls.badNonce ? "wrong-nonce" : flow.nonce,
          })
            .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
            .setIssuer(controls.badIssuer ? issuer + "/wrong" : issuer)
            .setAudience(
              controls.badAudience
                ? "wrong-client"
                : controls.badAuthorizedParty
                  ? ["fixture-client", "foreign-client"]
                  : "fixture-client",
            )
            .setSubject(subject)
            .sign(keys.privateKey);
          if (controls.badSignature) {
            const parts = idToken.split(".");
            parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
            idToken = parts.join(".");
          }
          const accessToken =
            "fixture-access-" + randomBytes(16).toString("hex");
          access.set(accessToken, { email: flow.email, subject });
          return void response
            .writeHead(200, { "content-type": "application/json" })
            .end(
              JSON.stringify({
                access_token: accessToken,
                refresh_token:
                  "fixture-refresh-" + randomBytes(16).toString("hex"),
                token_type: "Bearer",
                expires_in: 300,
                scope: "openid email profile",
                ...(controls.omitIdToken ? {} : { id_token: idToken }),
              }),
            );
        }
        if (url.pathname === "/userinfo") {
          const account = access.get(
            request.headers.authorization?.replace(/^Bearer /, "") ?? "",
          );
          if (!account) return void response.writeHead(401).end();
          return void response
            .writeHead(200, { "content-type": "application/json" })
            .end(
              JSON.stringify({
                sub: controls.badUserInfoSubject
                  ? "foreign-subject"
                  : account.subject,
                email: account.email,
                email_verified: true,
                name: "Provider visitor",
                picture: controls.picture,
              }),
            );
        }
        if (url.pathname === "/logout") {
          controls.logoutRequests++;
          return void response.writeHead(200).end("Provider logout");
        }
        response.writeHead(404).end();
      };
      void run().catch(() => {
        if (!response.headersSent) response.writeHead(500);
        response.end("Fixture request failed");
      });
    },
  );
  await new Promise<void>((yes, no) => {
    server.once("error", no);
    server.listen(0, "0.0.0.0", yes);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture listener");
  issuer = `${tls ? "https" : "http"}://localhost:${address.port}`;
  return { server, issuer, controls };
}
