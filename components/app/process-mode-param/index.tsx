"use client";

import { useQueryState } from "nuqs";
import { useEffect } from "react";
import { useTheme } from "next-themes";

export function ProcessModeParam() {
  const { setTheme } = useTheme();
  const [mode, setMode] = useQueryState("mode");

  useEffect(() => {
    if (!mode) return;

    if (mode && !!(mode === "light" || mode === "dark" || mode === "system")) {
      setTheme(mode);
      setMode(null);
    }
  }, [mode, setTheme, setMode]);

  return null;
}
