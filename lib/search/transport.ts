import { TRPCError } from "@trpc/server";

export function requireSearchBody(
  method: string | undefined,
  input: { searchValue: string; capability?: string; cursor?: unknown },
) {
  const continuation =
    typeof input.cursor === "object" &&
    input.cursor !== null &&
    "capability" in input.cursor;
  if (
    method !== undefined &&
    method !== "POST" &&
    (input.searchValue.trim() || input.capability || continuation)
  ) {
    throw new TRPCError({
      code: "METHOD_NOT_SUPPORTED",
      message: "SEARCH_BODY_REQUIRED",
    });
  }
}
