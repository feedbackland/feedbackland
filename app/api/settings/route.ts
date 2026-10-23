import { publicSettings } from "@/lib/settings";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const payload = await publicSettings(request.headers);
  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      ETag: `"${payload.publicVersion}"`,
    },
  });
}
