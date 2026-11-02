import { getAuth, getSocialAuth } from "@/lib/auth/server";
import { credentialHeaders } from "@/lib/auth/headers";
const handler = async (request: Request) => {
  // Capture one instance for this entire request. Background discovery may
  // replace the global instance, but never an in-flight callback's context.
  const auth = new URL(request.url).pathname.endsWith("/sign-in/social")
    ? await getSocialAuth()
    : getAuth();
  if (request.headers.get("x-feedbackland-scope") !== "embedded")
    return auth.handler(request);
  // Next wraps Request in a tracking proxy. Passing that proxy to the native
  // Request copy constructor fails its private-field brand check. Rebuild from
  // the URL and stream without consuming the body before auth rate admission.
  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers: credentialHeaders(request.headers),
    body: request.body,
    signal: request.signal,
    duplex: "half",
  };
  return auth.handler(new Request(request.url, init));
};
export { handler as GET, handler as POST };
