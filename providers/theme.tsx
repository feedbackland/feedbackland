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
    const mode = searchParams.get("mode");

    if (mode) {
      // Create a new URLSearchParams object from the current ones
      const newSearchParams = new URLSearchParams(searchParams.toString());

      // Remove the 'mode' parameter
      newSearchParams.delete("mode");

      // Update the URL without reloading the page.
      // The `replace` method avoids adding a new entry to the browser's history.
      router.replace(`${pathname}?${newSearchParams.toString()}`);
    }
  }, [searchParams, pathname, router]);

  return (
    <NextThemesProvider
      attribute="class"
      enableSystem={false}
      disableTransitionOnChange
      defaultTheme={mode}
    >
      {children}
    </NextThemesProvider>
  );
}
