"use client";

import { useQueryState } from "nuqs";
import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { isPlatformPreviewAtom } from "@/lib/atoms";

export function ProcessPreviewParam() {
  const [previewParam, setPreviewParam] = useQueryState("preview");
  const setIsPlatformPreview = useSetAtom(isPlatformPreviewAtom);

  useEffect(() => {
    if (!previewParam) return;

    if (previewParam === "true") {
      setPreviewParam(null);
      setIsPlatformPreview(true);
    }
  }, [previewParam, setPreviewParam, setIsPlatformPreview]);

  return null;
}
