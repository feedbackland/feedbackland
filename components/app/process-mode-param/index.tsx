"use client";

// import { useQueryState } from "nuqs";
// import { useEffect } from "react";
// import { useTheme } from "next-themes";

import { useLayoutEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";

export function ProcessModeParam() {
  const { setTheme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // useLayoutEffect runs synchronously before the browser repaints.
  // This is crucial for preventing the flicker of the old theme.
  useLayoutEffect(() => {
    const mode = searchParams.get("mode");

    if (mode === "dark" || mode === "light" || mode === "system") {
      // Set the theme based on the 'mode' parameter
      setTheme(mode);

      // Create a new URLSearchParams object from the current ones
      const newSearchParams = new URLSearchParams(searchParams.toString());

      // Remove the 'mode' parameter
      newSearchParams.delete("mode");

      // Update the URL without reloading the page.
      // The `replace` method avoids adding a new entry to the browser's history.
      router.replace(`${pathname}?${newSearchParams.toString()}`);
    }
  }, [searchParams, pathname, router, setTheme]);

  return null;

  // const { setTheme } = useTheme();
  // const [modeParam, setModeParam] = useQueryState("mode");

  // useEffect(() => {
  //   if (!modeParam) return;

  //   if (modeParam) {
  //     if (
  //       modeParam === "light" ||
  //       modeParam === "dark" ||
  //       modeParam === "system"
  //     ) {
  //       setTheme(modeParam);
  //     }

  //     setModeParam(null);
  //   }
  // }, [modeParam, setTheme, setModeParam]);

  // return null;
}
