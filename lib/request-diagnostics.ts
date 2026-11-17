import "server-only";
import { getConfig } from "./config";
import { runtimeState } from "./runtime-state";
import { getAppUrl } from "./app-url";
import identity from "./build-identity.json";

export function recordRequest(headers: Headers) {
  const samples = (runtimeState().requestSamples ??= []);
  const value = headers.get("host");
  // Preserve only the routable host and one presence bit per request.
  const host =
    value && value.length <= 253 && /^[a-z0-9.:[\]-]+$/i.test(value)
      ? value.toLowerCase()
      : null;
  samples.push({
    host,
    hasClientIp: !!headers.get(getConfig().clientIpHeader)?.trim(),
  });
  if (samples.length > 100) samples.shift();
}
export function systemStatus(headers: Headers) {
  const config = getConfig(),
    { appUrl, inferred } = getAppUrl(headers),
    host = new URL(appUrl).host.toLowerCase();
  const samples = runtimeState().requestSamples ?? [];
  return {
    version: identity.version,
    appUrl,
    source: inferred ? "request headers" : config.appUrlSource,
    recoveryEnabled: !!config.recoveryCode,
    clientIpHeader: config.clientIpHeader,
    requests: samples.length,
    missingClientIp: samples.filter((r) => !r.hasClientIp).length,
    mismatchedHost: samples.filter((r) => r.host !== host).length,
  };
}
