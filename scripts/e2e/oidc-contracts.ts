import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "../../lib/auth/options";
import type { OidcMetadata } from "../../lib/auth/oidc";
import { createOidcMock } from "../../ci/oidc-mock";

export async function oidcContracts(
  deps: Parameters<typeof buildAuthOptions>[0],
) {
  const mock = await createOidcMock();
  try {
    mock.controls.ready = true;
    const metadata = (await (
      await fetch(mock.issuer + "/.well-known/openid-configuration")
    ).json()) as OidcMetadata;
    const auth = betterAuth(
      buildAuthOptions({
        ...deps,
        oidc: {
          metadata,
          clientId: "fixture-client",
          clientSecret: "fixture-secret",
        },
      }),
    );
    const provider = (await auth.$context).socialProviders.find(
      (item) => item.id === "oidc",
    )!;
    assert(provider?.idToken && provider.requiresIdTokenNonce);
    for (const failure of [
      null,
      "badNonce",
      "badIssuer",
      "badAudience",
      "badSignature",
      "omitIdToken",
      "omitExpiration",
      "omitIssuedAt",
      "badAuthorizedParty",
      "emailInUserInfo",
      "badUserInfoSubject",
    ] as const) {
      if (failure) mock.controls[failure] = true;
      const nonce = randomBytes(16).toString("hex"),
        verifier = randomBytes(32).toString("base64url");
      const redirect = "https://localhost/api/auth/callback/oidc";
      const authorization = await provider.createAuthorizationURL({
        state: "fixture-state",
        codeVerifier: verifier,
        idTokenNonce: nonce,
        redirectURI: redirect,
      });
      assert.equal(authorization.searchParams.get("nonce"), nonce);
      authorization.pathname = "/approve";
      authorization.searchParams.set("email", "verified@fixture.invalid");
      authorization.searchParams.set("decision", "allow");
      const approve = await fetch(authorization, { redirect: "manual" });
      assert.equal(approve.status, 302);
      const code = new URL(approve.headers.get("location")!).searchParams.get(
        "code",
      )!;
      const tokens = await provider.validateAuthorizationCode({
        code,
        codeVerifier: verifier,
        redirectURI: redirect,
      });
      assert(tokens);
      const result = await provider.getUserInfo({
        ...tokens,
        expectedIdTokenNonce: nonce,
      });
      if (failure && failure !== "emailInUserInfo")
        assert.equal(result, null, failure + " was accepted");
      else {
        assert.equal(result?.user.email, "verified@fixture.invalid");
        assert.equal(
          await provider.accountSubject!({ tokens, profile: result!.data! }),
          createHash("sha256")
            .update(
              JSON.stringify([
                metadata.issuer,
                createHash("sha256")
                  .update("verified@fixture.invalid")
                  .digest("hex"),
              ]),
            )
            .digest("hex"),
        );
      }
      if (failure) mock.controls[failure] = false;
    }
    const other = betterAuth(
      buildAuthOptions({
        ...deps,
        oidc: {
          metadata: { ...metadata, issuer: metadata.issuer + "/different" },
          clientId: "fixture-client",
          clientSecret: "fixture-secret",
        },
      }),
    );
    const otherProvider = (await other.$context).socialProviders.find(
      (item) => item.id === "oidc",
    )!;
    assert.notEqual(
      await provider.accountSubject!({
        tokens: {},
        profile: { sub: "shared-subject" },
      }),
      await otherProvider.accountSubject!({
        tokens: {},
        profile: { sub: "shared-subject" },
      }),
      "Replacing the issuer adopted the old issuer's subject",
    );
    assert.equal(mock.controls.logoutRequests, 0);
    assert.equal(await provider.createEndSessionURL?.({}), null);
    assert(mock.controls.jwksRequests > 0);
  } finally {
    mock.server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      mock.server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
