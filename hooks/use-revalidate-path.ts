"use client";

import { useAction } from "next-safe-action/hooks";
import { revalidatePathAction } from "@/actions/revalidate-path";

export function useRevalidatePath() {
  const { executeAsync } = useAction(revalidatePathAction);
  return executeAsync;
}
