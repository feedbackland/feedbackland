"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useSearchParams } from "next/navigation";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const embedded = params.getAll("embed").includes("drawer");
  const mode = params.get("mode");
  return (
    <NextThemesProvider
      key={embedded ? "drawer" : "first-party"}
      attribute="class"
      enableSystem={false}
      disableTransitionOnChange
      storageKey={embedded ? "feedbackland-embed-theme" : "theme"}
      forcedTheme={
        embedded && (mode === "dark" || mode === "light") ? mode : undefined
      }
    >
      {children}
    </NextThemesProvider>
  );
}
