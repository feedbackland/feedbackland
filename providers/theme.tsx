"use client";

import { useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState(searchParams?.get("mode"));

  // When the widget embeds the board it passes the host's theme as `?mode=`.
  // In that case persist/read the theme under an isolated key so the embedded
  // view never overwrites a visitor's own standalone preference (next-themes'
  // default `theme` key) at the same origin. Mirrors the boot script in
  // app/layout.tsx, which seeds this same key before first paint.
  const isEmbedded = theme === "dark" || theme === "light";
  const storageKey = isEmbedded ? "feedbackland-embed-theme" : "theme";

  useEffect(() => {
    const mode = searchParams?.get("mode");

    if (mode) {
      if (!theme) setTheme(mode);
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete("mode");
      router.replace(`${pathname}?${newSearchParams.toString()}`);
    }
  }, [searchParams, pathname, router, theme]);

  return (
    <NextThemesProvider
      attribute="class"
      enableSystem={false}
      disableTransitionOnChange
      storageKey={storageKey}
      defaultTheme={isEmbedded ? theme! : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
