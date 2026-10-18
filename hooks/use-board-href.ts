"use client";
import { useCallback } from "react";
import { boardHref } from "@/lib/board-href";
import { useEmbedSurface } from "@/providers/embed";
export function useBoardHref() {
  const surface = useEmbedSurface();
  return useCallback((path = "/") => boardHref(path, surface), [surface]);
}
