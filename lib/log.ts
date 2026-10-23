import "server-only";
type Fields = {
  stage?: string;
  sqlstate?: string;
  host?: string;
  port?: string;
  name?: string;
  version?: string;
  dimensions?: number;
  count?: number;
};
// Never serialize errors/causes, URLs, PEMs or arbitrary provider data.
export function log(
  event: string,
  fields: Fields = {},
  level: "info" | "warn" | "error" = "info",
) {
  const safe: Record<string, string | number> = {
    event: event.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80),
  };
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (
      typeof value === "string" &&
      /^[a-zA-Z0-9_+.:[\]-]{1,253}$/.test(value)
    )
      safe[key] = value;
  }
  console[level](JSON.stringify(safe));
}
export function sqlstate(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[0-9A-Z]{5}$/.test(error.code)
  )
    return error.code;
}
