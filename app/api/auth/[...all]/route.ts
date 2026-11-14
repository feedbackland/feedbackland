import { getAuth } from "@/lib/auth/server";
import { credentialHeaders } from "@/lib/auth/headers";
import { boundedRequest, BodyError } from "@/lib/http/limited-body";
const handler = async (request: Request) => {
  const auth = getAuth();
  const headers = credentialHeaders(request.headers);
  try {
    if (request.method === "POST")
      request = await boundedRequest(request, 64 * 1024, headers);
    else if (request.headers.get("x-feedbackland-scope") === "embedded")
      request = new Request(request.url, { headers, signal: request.signal });
    return auth.handler(request);
  } catch (error) {
    if (error instanceof BodyError) return error.response();
    throw error;
  }
};
export { handler as GET, handler as POST };
