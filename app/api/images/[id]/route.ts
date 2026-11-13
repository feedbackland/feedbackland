import { db } from "@/db/db";
import { imageId } from "@/lib/images/path";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = imageId("/api/images/" + (await params).id);
  const missing = () =>
    new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  if (!id) return missing();
  const etag = '"' + id + '"';
  const matches = (request.headers.get("if-none-match") ?? "")
    .split(",")
    .some((value) => ["*", etag, "W/" + etag].includes(value.trim()));
  const query = db.selectFrom("images").where("id", "=", id);
  const headers = {
    "Cache-Control": "public, max-age=86400",
    ETag: etag,
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'none'; sandbox; frame-ancestors 'none'",
  };
  if (matches)
    return (await query.select("id").executeTakeFirst())
      ? new Response(null, { status: 304, headers })
      : missing();
  const image = await query
    .select(["bytes", "contentType", "byteSize"])
    .executeTakeFirst();
  if (!image) return missing();
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      ...headers,
      "Content-Type": image.contentType,
      "Content-Length": String(image.byteSize),
    },
  });
}
