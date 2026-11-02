import "server-only";
export function mutationGuard(request: Request) {
  const type = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (type !== "application/json")
    return Response.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  if (
    ["same-site", "cross-site"].includes(
      request.headers.get("sec-fetch-site") ?? "",
    )
  )
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  return null;
}
