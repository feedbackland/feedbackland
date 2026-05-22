"use client";

import { useEffect, useState } from "react";

export type FeedbackTheme = "light" | "dark";
export type FeedbackThemeOption = FeedbackTheme | "auto";

function readTheme(): FeedbackTheme {
  if (typeof window === "undefined") return "light";
  if (document.documentElement.classList.contains("dark")) return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Resolves the active theme using three signals (in priority order):
 *   1. The `option` prop when explicitly "light" or "dark".
 *   2. `<html class="dark">` when set by the host.
 *   3. The OS `prefers-color-scheme` media query.
 *
 * Reactive to both the host toggling the class and the OS preference changing.
 */
export function useTheme(option: FeedbackThemeOption = "auto"): FeedbackTheme {
  const [theme, setTheme] = useState<FeedbackTheme>(() =>
    option !== "auto" ? option : readTheme(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (option !== "auto") {
      setTheme(option);
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const compute = () => setTheme(readTheme());

    compute();

    mq.addEventListener("change", compute);
    const mo = new MutationObserver(compute);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mq.removeEventListener("change", compute);
      mo.disconnect();
    };
  }, [option]);

  return theme;
}
