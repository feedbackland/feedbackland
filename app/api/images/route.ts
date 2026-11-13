import { isSetupComplete } from "@/lib/setup-state";
import { getConfig } from "@/lib/config";
import { enforceImageLimit, getClientIp } from "@/lib/rate-limit";
import { runtimeState } from "@/lib/runtime-state";
import { BodyError, checkLength, discardBody } from "@/lib/http/limited-body";
import { readImagePart } from "@/lib/images/multipart";
import { inspectImage } from "@/lib/images/container-limits";
import { storeImage } from "@/lib/images/store";
import { imageUrl } from "@/lib/images/path";
export async function POST(request: Request) {
  const state = runtimeState();
  let acquired = false;
  try {
    if (!(await isSetupComplete())) throw new BodyError(403, "SETUP_REQUIRED");
    const max = getConfig().maxImageBytes;
    checkLength(request, max + 65536);
    if ((state.uploads ?? 0) >= 2) throw new BodyError(429, "UPLOAD_BUSY");
    state.uploads = (state.uploads ?? 0) + 1;
    acquired = true;
    if (!(await enforceImageLimit(getClientIp(request.headers))).allowed)
      throw new BodyError(429, "RATE_LIMITED");
    const bytes = await readImagePart(request, max);
    const image = await storeImage(bytes, inspectImage(bytes));
    return Response.json(
      { ...image, url: imageUrl(image.id) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    discardBody(request);
    if (error instanceof BodyError)
      return error.response({
        "Cache-Control": "no-store",
        ...(error.status === 429
          ? { "Retry-After": error.code === "UPLOAD_BUSY" ? "5" : "60" }
          : {}),
      });
    return Response.json(
      { error: "UPLOAD_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    if (acquired) state.uploads = (state.uploads ?? 1) - 1;
  }
}
