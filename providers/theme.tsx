"use client";

import { useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState(searchParams?.get("mode"));

  const forcedTheme = searchParams?.get("mode") || theme || "light";

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
      forcedTheme={searchParams?.get("mode") || theme || "light"}
    >
      {children}
    </NextThemesProvider>
  );
}
