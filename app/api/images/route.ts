import { isSetupComplete } from "@/lib/setup-state";
import { getConfig } from "@/lib/config";
import { enforceImageLimit, getClientIp } from "@/lib/rate-limit";
import { runtimeState } from "@/lib/runtime-state";
import { BodyError, checkLength, discardBody } from "@/lib/http/limited-body";
import { readImagePart } from "@/lib/images/multipart";
import { inspectImage } from "@/lib/images/container-limits";
import { storeImage } from "@/lib/images/store";
import { uploadDeadline } from "@/lib/images/upload-deadline";
import { imageUrl } from "@/lib/images/path";
export async function POST(request: Request) {
  const state = runtimeState();
  const deadline = uploadDeadline(request.signal);
  let acquired = false;
  try {
    if (!(await isSetupComplete(deadline)))
      throw new BodyError(403, "SETUP_REQUIRED");
    const max = getConfig().maxImageBytes;
    checkLength(request, max + 65536);
    if ((state.uploads ?? 0) >= 2) throw new BodyError(429, "UPLOAD_BUSY");
    state.uploads = (state.uploads ?? 0) + 1;
    acquired = true;
    if (
      !(await enforceImageLimit(getClientIp(request.headers), deadline)).allowed
    )
      throw new BodyError(429, "RATE_LIMITED");
    const bytes = await readImagePart(request, max, deadline.remaining());
    const image = await storeImage(bytes, inspectImage(bytes), deadline);
    return Response.json(
      { ...image, url: imageUrl(image.id) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    const error = request.signal.aborted
      ? new BodyError(400, "BODY_INTERRUPTED")
      : deadline.signal.aborted
        ? new BodyError(408, "UPLOAD_TIMEOUT")
        : cause;
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
