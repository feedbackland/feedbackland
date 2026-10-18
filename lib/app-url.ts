import "server-only";
import { getConfig } from "./config";
export function getAppUrl(headers?: Headers): {
  appUrl: string;
  inferred: boolean;
} {
  const configured = getConfig().appUrl;
  if (configured) return { appUrl: configured, inferred: false };
  if (!headers) throw new Error("An inferred app URL requires request headers");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const protocol = headers.get("x-forwarded-proto") ?? "http";
  if (
    !host ||
    !["http", "https"].includes(protocol) ||
    /[\s,/@\\?#]/.test(host)
  )
    throw new Error("Invalid public request origin");
  const url = new URL(`${protocol}://${host}`);
  if (!url.hostname || url.pathname !== "/")
    throw new Error("Invalid public request origin");
  return { appUrl: url.origin, inferred: true };
}
