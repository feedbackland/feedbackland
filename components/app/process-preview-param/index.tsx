"use client";

import { useQueryState } from "nuqs";
import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { isPlatformPreviewAtom } from "@/lib/atoms";

export function ProcessPreviewParam() {
  const [preview, setPreview] = useQueryState("preview");
  const setIsPlatformPreview = useSetAtom(isPlatformPreviewAtom);

  useEffect(() => {
    if (!preview) return;

    if (preview === "true") {
      setPreview(null);
      setIsPlatformPreview(true);
    }
  }, [preview, setPreview, setIsPlatformPreview]);

  return null;
}
