import "server-only";
/** Embedded callers authenticate solely with the signed bearer. This also
 * protects against browser ports that incorrectly send cookies despite omit. */
export function credentialHeaders(headers: Headers) {
  if (headers.get("x-feedbackland-scope") !== "embedded") return headers;
  const isolated = new Headers(headers);
  isolated.delete("cookie");
  return isolated;
}
