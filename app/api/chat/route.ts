import { ASK_AI_SESSION_HEADER } from "@/lib/ask-ai";
import { credentialHeaders } from "@/lib/auth/headers";
import { mutationGuard } from "@/lib/http/mutation-guard";
import {
  BodyError,
  boundedRequest,
  checkLength,
  discardBody,
} from "@/lib/http/limited-body";
import { isSetupComplete } from "@/lib/setup-state";
import { getAuth, requireAdminSession } from "@/lib/auth/server";
import { DomainError } from "@/lib/domain-error";
import {
  answerBoardQuestion,
  askAiFailure,
  askAiInput,
} from "@/lib/llm/ask-ai";

const limit = 1024 * 1024;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const rejected = mutationGuard(request);
  if (rejected) {
    discardBody(request);
    return rejected;
  }
  try {
    checkLength(request, limit);
    if (!(await isSetupComplete())) {
      discardBody(request);
      return Response.json(
        { error: "SETUP_REQUIRED" },
        { status: 403, headers: noStore },
      );
    }
    const { user, session } = requireAdminSession(
      await getAuth().api.getSession({
        headers: credentialHeaders(request.headers),
      }),
    );
    // A mounted tab can briefly hold an old chat after a session changes.
    // Never accept that chat's history under the new administrator's cookie.
    const expectedSession = request.headers.get(ASK_AI_SESSION_HEADER);
    if (expectedSession !== null && expectedSession !== session.id)
      throw new DomainError("FORBIDDEN", "Chat session changed");
    const body = await boundedRequest(request, limit);
    let input: ReturnType<typeof askAiInput>;
    try {
      input = askAiInput(await body.json());
    } catch {
      return Response.json(
        { error: "INVALID_CHAT_INPUT" },
        { status: 400, headers: noStore },
      );
    }
    return await answerBoardQuestion(
      { userId: user.id, sessionId: session.id },
      input,
      request.signal,
    );
  } catch (error) {
    discardBody(request);
    if (error instanceof BodyError) return error.response(noStore);
    if (error instanceof DomainError) {
      const headers = new Headers(noStore);
      if (error.retryAfterSeconds !== undefined)
        headers.set("Retry-After", String(error.retryAfterSeconds));
      return Response.json(
        {
          error:
            error.code === "SERVICE_UNAVAILABLE"
              ? "AI_UNAVAILABLE"
              : error.code,
        },
        { status: error.status, headers },
      );
    }
    return askAiFailure(error, request.signal);
  }
}
