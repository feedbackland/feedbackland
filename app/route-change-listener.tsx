"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSetAtom } from "jotai";
import { isFeedbackFormOpenAtom } from "@/lib/atoms";
import { usePreviousDistinct } from "react-use";

export function RouteChangeListener() {
  const pathname = usePathname();
  const prevPathname = usePreviousDistinct(pathname);
  const setIsFeedbackFormOpenAtom = useSetAtom(isFeedbackFormOpenAtom);

  useEffect(() => {
    if (!prevPathname && pathname) {
      setIsFeedbackFormOpenAtom(true);
    }

    if (pathname && prevPathname && pathname !== prevPathname) {
      setIsFeedbackFormOpenAtom(false);
    }
  }, [pathname, prevPathname, setIsFeedbackFormOpenAtom]);

  return null;
}
