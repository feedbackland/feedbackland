"use client";
import { useCallback } from "react";
import { boardHref } from "@/lib/board-href";
import { useEmbedSurface } from "@/providers/embed";
import { useSearchParams } from "next/navigation";
export function useBoardHref() {
  const surface = useEmbedSurface();
  const mode = useSearchParams().get("mode");
  return useCallback(
    (path = "/") => boardHref(path, surface, mode),
    [surface, mode],
  );
}
