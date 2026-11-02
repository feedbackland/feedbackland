import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { createRemoteJWKSet, decodeJwt } from "jose";
import { createHash } from "node:crypto";

export type OidcMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  id_token_signing_alg_values_supported: string[];
};

/** Adapt bounded, validated discovery to the SDK's public plugin/provider API. */
export function oidcProvider(config: {
  clientId: string;
  clientSecret: string;
  metadata: OidcMetadata;
}) {
  const { metadata } = config;
  const plugin = genericOAuth({
    config: [
      {
        providerId: "oidc",
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authorizationUrl: metadata.authorization_endpoint,
        tokenUrl: metadata.token_endpoint,
        userInfoUrl: metadata.userinfo_endpoint,
        scopes: ["openid", "email", "profile"],
        disableProviderLogout: true,
        overrideUserInfo: true,
        accountSubject: ({ profile }) =>
          typeof profile.sub === "string" && profile.sub
            ? createHash("sha256")
                .update(JSON.stringify([metadata.issuer, profile.sub]))
                .digest("hex")
            : "",
      },
    ],
  });
  const initialize = plugin.init;
  plugin.init = async (context) => {
    const result = await initialize(context);
    const provider = result.context.socialProviders.find(
      (item) => item.id === "oidc",
    );
    if (!provider) throw new Error("OIDC provider construction failed");
    // genericOAuth 1.7.6's discovery fetch cannot be bounded or supplied a
    // document. Configure its returned provider before registration instead.
    // Its getUserInfo closure uses this same provider's idToken configuration
    // and the SDK's shared verifier for signature, issuer, audience and nonce.
    provider.issuer = metadata.issuer;
    provider.requiresIdTokenNonce = true;
    provider.idToken = {
      jwks: createRemoteJWKSet(new URL(metadata.jwks_uri), {
        timeoutDuration: 10_000,
      }),
      issuer: metadata.issuer,
      audience: config.clientId,
      algorithms: metadata.id_token_signing_alg_values_supported,
      // OIDC Core requires sub/iat/exp. jose validates exp when present, but
      // does not require it; also enforce the authorized party for multi-aud.
      verifyClaims: (claims) =>
        typeof claims.sub === "string" &&
        claims.sub.length > 0 &&
        typeof claims.iat === "number" &&
        Number.isFinite(claims.iat) &&
        typeof claims.exp === "number" &&
        Number.isFinite(claims.exp) &&
        claims.iat <= Date.now() / 1000 + 60 &&
        (claims.azp === undefined || claims.azp === config.clientId) &&
        (!Array.isArray(claims.aud) ||
          claims.aud.length <= 1 ||
          claims.azp === config.clientId),
    };
    const userInfo = provider.getUserInfo;
    provider.getUserInfo = async (tokens) => {
      if (!tokens.idToken) return null;
      const result = await userInfo(tokens);
      if (
        !result?.data ||
        !("sub" in result.data) ||
        result.data.sub !== decodeJwt(tokens.idToken).sub
      )
        return null;
      return result;
    };
    return result;
  };
  return plugin;
}
