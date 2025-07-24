"use client";

import { useQueryState } from "nuqs";
import { useEffect } from "react";
import { useTheme } from "next-themes";

export function ProcessModeParam() {
  const { setTheme } = useTheme();
  const [modeParam, setModeParam] = useQueryState("mode");

  useEffect(() => {
    if (!modeParam) return;

    if (modeParam) {
      if (modeParam === "light" || modeParam === "dark") {
        setTheme(modeParam);
      }

      setModeParam(null);
    }
  }, [modeParam, setTheme, setModeParam]);

  return null;
}
