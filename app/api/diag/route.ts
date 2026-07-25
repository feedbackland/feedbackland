// TEMPORARY diagnostic route. Reports the serverless runtime's module-loading
// capabilities so the firebase-admin/jose ERR_REQUIRE_ESM failure can be
// pinned down. Remove once the cause is fixed.
export const dynamic = "force-dynamic";

const attempt = async (label: string, fn: () => unknown | Promise<unknown>) => {
  try {
    const value = await fn();
    return [label, `ok: ${typeof value === "object" && value ? Object.keys(value as object).length + " keys" : String(value)}`];
  } catch (error) {
    return [label, `FAIL: ${error instanceof Error ? `${(error as NodeJS.ErrnoException).code ?? ""} ${error.message}` : String(error)}`];
  }
};

export async function GET() {
  const { createRequire } = await import("node:module");

  const checks = await Promise.all([
    attempt("import('jose')", () => import("jose")),
    attempt("require('jose')", () => {
      const req = createRequire(process.cwd() + "/index.js");
      return req("jose");
    }),
    attempt("import('jwks-rsa')", () => import("jwks-rsa")),
    attempt("import('firebase-admin/auth')", () => import("firebase-admin/auth")),
  ]);

  return Response.json(
    {
      nodeVersion: process.version,
      execArgv: process.execArgv,
      nodeOptions: process.env.NODE_OPTIONS ?? null,
      awsRuntime: process.env.AWS_EXECUTION_ENV ?? null,
      region: process.env.VERCEL_REGION ?? null,
      cwd: process.cwd(),
      checks: Object.fromEntries(checks),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
