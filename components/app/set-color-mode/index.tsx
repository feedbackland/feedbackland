"use client";

import { useQueryState } from "nuqs";
import { useEffect } from "react";
import { useTheme } from "next-themes";

export function SetColorMode() {
  const { setTheme } = useTheme();
  const [mode, setMode] = useQueryState("mode");

  useEffect(() => {
    if (mode) {
      setTheme(mode);
      setMode(null);
    }
  }, [mode, setTheme, setMode]);

  return null;
}
