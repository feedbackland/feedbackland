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
    if (error instanceof DomainError)
      return Response.json(
        { error: error.code },
        { status: error.status, headers: noStore },
      );
    return askAiFailure(error, request.signal);
  }
}
