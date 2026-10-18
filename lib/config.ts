import "server-only";
import { checkServerIdentity } from "node:tls";
import { X509Certificate } from "node:crypto";
import { BlockList, isIP } from "node:net";
import type { PoolConfig } from "pg";
import { runtimeState } from "./runtime-state";
import { log } from "./log";
export class ConfigurationError extends Error {}
const value = (name: string) => process.env[name]?.trim() || undefined;
function integer(name: string, fallback: number, min: number, max: number) {
  const raw = value(name);
  const number = raw === undefined ? fallback : Number(raw);
  if (
    (raw !== undefined && !/^[1-9][0-9]*$/.test(raw)) ||
    !Number.isSafeInteger(number) ||
    number < min ||
    number > max
  )
    throw new ConfigurationError(
      `${name} must be an integer from ${min} to ${max}`,
    );
  return number;
}
export const AUTH_ENV_TO_NEUTRALISE = Object.freeze([
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_BETTER_AUTH_URL",
  "PUBLIC_BETTER_AUTH_URL",
  "NUXT_PUBLIC_BETTER_AUTH_URL",
  "NUXT_PUBLIC_AUTH_URL",
  "BASE_URL",
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "BETTER_AUTH_SECRETS",
  "AUTH_SECRET",
  "BETTER_AUTH_TELEMETRY",
  "BETTER_AUTH_TELEMETRY_ENDPOINT",
  "BETTER_AUTH_TELEMETRY_ID",
  "BETTER_AUTH_TELEMETRY_DEBUG",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_AUTH_URL",
  "VERCEL_URL",
  "TEST",
] as const);
export function neutraliseAuthEnv() {
  for (const name of AUTH_ENV_TO_NEUTRALISE) {
    if (process.env[name] !== undefined)
      log("config.neutralised", { name }, "warn");
    delete process.env[name];
  }
}
/** All runtime/tooling connections use this. Strip SSL URL selectors only
 * after interpreting them, so pg cannot override policy or read local files. */
export function parseDatabaseOptions(
  raw: string | undefined,
  ca?: string,
): PoolConfig {
  if (!raw?.trim()) throw new ConfigurationError("DATABASE_URL is not set");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigurationError("DATABASE_URL must be a Postgres URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    url.hash
  )
    throw new ConfigurationError(
      "DATABASE_URL must be a Postgres URL without a fragment",
    );
  const selectors = ["ssl", "sslmode"];
  const unsupported = [
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslpassword",
    "uselibpqcompat",
  ];
  for (const [key] of url.searchParams) {
    if (unsupported.includes(key.toLowerCase()))
      throw new ConfigurationError(
        `DATABASE_URL unsupported option ${key.toLowerCase()}`,
      );
    if (selectors.includes(key.toLowerCase()) && key !== key.toLowerCase())
      throw new ConfigurationError(
        "DATABASE_URL TLS selectors must be lowercase",
      );
  }
  for (const key of selectors)
    if (url.searchParams.getAll(key).length > 1)
      throw new ConfigurationError(`DATABASE_URL duplicate ${key}`);
  if (selectors.every((key) => url.searchParams.has(key)))
    throw new ConfigurationError("DATABASE_URL ssl and sslmode conflict");
  const alias = url.searchParams.get("ssl");
  if (alias !== null && alias !== "true" && alias !== "false")
    throw new ConfigurationError("DATABASE_URL ssl must be true or false");
  const mode =
    url.searchParams.get("sslmode") ??
    (alias === "true"
      ? "verify-full"
      : alias === "false"
        ? "disable"
        : ca
          ? "verify-full"
          : "disable");
  if (
    !["disable", "require", "prefer", "verify-ca", "verify-full"].includes(mode)
  )
    throw new ConfigurationError("DATABASE_URL sslmode is unsupported");
  if (ca && !["verify-ca", "verify-full"].includes(mode))
    throw new ConfigurationError(
      "DATABASE_SSL_CA requires verify-ca or verify-full",
    );
  if (mode === "verify-ca" && !ca)
    throw new ConfigurationError("DATABASE_SSL_CA is required for verify-ca");
  if (ca) {
    const certificates = ca.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
    );
    try {
      if (
        !certificates?.length ||
        ca
          .replace(
            /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
            "",
          )
          .trim()
      )
        throw new ConfigurationError();
      for (const certificate of certificates) new X509Certificate(certificate);
    } catch {
      throw new ConfigurationError(
        "DATABASE_SSL_CA must contain PEM certificates",
      );
    }
  }
  selectors.forEach((key) => url.searchParams.delete(key));
  return {
    connectionString: url.toString(),
    ssl:
      mode === "disable"
        ? false
        : {
            rejectUnauthorized: mode !== "require" && mode !== "prefer",
            ...(ca ? { ca } : {}),
            checkServerIdentity:
              mode === "verify-ca"
                ? () => undefined
                : (_host, cert) =>
                    checkServerIdentity(
                      url.hostname.replace(/^\[|\]$/g, ""),
                      cert,
                    ),
          },
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  };
}
export function validateCode(name: string, raw: string | undefined) {
  if (!raw) return undefined;
  const hex = /^[0-9a-fA-F]{64}$/.test(raw);
  const bytes = Buffer.from(raw, hex ? "hex" : "base64");
  const repeated = Array.from({ length: 16 }, (_, n) => n + 1).some((length) =>
    bytes.every((b, i) => b === bytes[i % length]),
  );
  const cycle = [1, 255].some((step) =>
    bytes.every((b, i) => i === 0 || b === (bytes[i - 1] + step) % 256),
  );
  if (
    bytes.length !== 32 ||
    (!hex && (raw.length !== 44 || bytes.toString("base64") !== raw)) ||
    repeated ||
    cycle
  )
    throw new ConfigurationError(
      `${name} must be a random 32-byte secret in canonical hex or padded base64`,
    );
  return raw;
}
export function getConfig() {
  const trustedProxies =
    value("TRUSTED_PROXIES")
      ?.split(",")
      .map((entry) => entry.trim()) ?? [];
  for (const entry of trustedProxies) {
    const [address, prefix, extra] = entry.split("/");
    const family = isIP(address);
    const width =
      prefix === undefined ? (family === 4 ? 32 : 128) : Number(prefix);
    if (
      !family ||
      extra !== undefined ||
      (prefix !== undefined && !/^(0|[1-9][0-9]*)$/.test(prefix)) ||
      width > (family === 4 ? 32 : 128)
    )
      throw new ConfigurationError(
        "TRUSTED_PROXIES must contain valid IP addresses or CIDRs",
      );
    new BlockList().addSubnet(address, width, family === 4 ? "ipv4" : "ipv6");
  }
  const clientIpHeader =
    value("CLIENT_IP_HEADER")?.toLowerCase() ?? "x-forwarded-for";
  if (!/^[a-z0-9-]+$/.test(clientIpHeader))
    throw new ConfigurationError(
      "CLIENT_IP_HEADER must be a valid header name",
    );
  const configuredUrl =
    value("APP_URL") ??
    value("RENDER_EXTERNAL_URL") ??
    (value("RAILWAY_PUBLIC_DOMAIN")
      ? `https://${value("RAILWAY_PUBLIC_DOMAIN")}`
      : undefined);
  const appUrlSource = value("APP_URL")
    ? "APP_URL"
    : value("RENDER_EXTERNAL_URL")
      ? "RENDER_EXTERNAL_URL"
      : value("RAILWAY_PUBLIC_DOMAIN")
        ? "RAILWAY_PUBLIC_DOMAIN"
        : "inferred-per-request";
  let appUrl: string | undefined;
  if (configuredUrl) {
    let url: URL;
    try {
      url = new URL(configuredUrl);
    } catch {
      throw new ConfigurationError("APP_URL must be an HTTP(S) origin");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new ConfigurationError("APP_URL must be an HTTP(S) origin");
    appUrl = url.origin;
  }
  return {
    appUrl,
    appUrlSource,
    database: () =>
      parseDatabaseOptions(value("DATABASE_URL"), value("DATABASE_SSL_CA")),
    poolMax: integer("DATABASE_POOL_MAX", 10, 2, 1000),
    dimensions: integer("AI_EMBEDDING_DIMENSIONS", 768, 1, 4000),
    injectedAuthSecret: value("BETTER_AUTH_SECRET"),
    get authSecret() {
      const secret = runtimeState().authSecret;
      if (!secret)
        throw new ConfigurationError("Auth secret requested before boot");
      return secret;
    },
    setupCode: value("SETUP_CODE"),
    recoveryCode: validateCode("RECOVERY_CODE", value("RECOVERY_CODE")),
    clientIpHeader,
    trustedProxies,
    llm: {
      apiKey: undefined,
      chatEnabled: false,
      embeddingsEnabled: false,
    } as const,
  };
}
