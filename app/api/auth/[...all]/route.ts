import { getAuth } from "@/lib/auth/server";
import { credentialHeaders } from "@/lib/auth/headers";
const handler = (request: Request) => {
  if (request.headers.get("x-feedbackland-scope") !== "embedded")
    return getAuth().handler(request);
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
  return getAuth().handler(new Request(request.url, init));
};
export { handler as GET, handler as POST };
