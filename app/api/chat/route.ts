import { credentialHeaders } from "@/lib/auth/headers";
import { mutationGuard } from "@/lib/http/mutation-guard";
import { isSetupComplete } from "@/lib/setup-state";
import { getAuth, requireAdminSession } from "@/lib/auth/server";
import { DomainError } from "@/lib/domain-error";
export async function POST(request: Request) {
  const rejected = mutationGuard(request);
  if (rejected) return rejected;
  if (!(await isSetupComplete()))
    return Response.json({ error: "SETUP_REQUIRED" }, { status: 403 });
  try {
    requireAdminSession(
      await getAuth().api.getSession({
        headers: credentialHeaders(request.headers),
      }),
    );
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    return Response.json(
      { error: error.code },
      {
        status: error.code === "UNAUTHORIZED" ? 401 : 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  return Response.json(
    { error: "AI_DISABLED" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
