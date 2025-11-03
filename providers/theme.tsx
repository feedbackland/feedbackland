"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode = searchParams?.get("mode") || undefined;

  useEffect(() => {
    const mode = searchParams?.get("mode");

    if (mode) {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete("mode");
      router.replace(`${pathname}?${newSearchParams.toString()}`);
    }
  }, [searchParams, pathname, router]);

  return (
    <NextThemesProvider
      attribute="class"
      enableSystem={false}
      disableTransitionOnChange
      defaultTheme={mode || "light"}
    >
      {children}
    </NextThemesProvider>
  );
}
