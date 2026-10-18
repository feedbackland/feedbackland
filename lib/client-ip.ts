import "server-only";
import { getIP } from "better-auth/api";
import { getConfig } from "./config";
export function getClientIp(headers: Headers): string {
  const config = getConfig();
  return (
    getIP(headers, {
      advanced: {
        ipAddress: {
          ipAddressHeaders: [config.clientIpHeader],
          trustedProxies: config.trustedProxies,
        },
      },
    }) ?? "unknown"
  );
}
