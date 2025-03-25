"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSetAtom } from "jotai";
import { isFeedbackFormOpenAtom, previousPathnameAtom } from "@/lib/atoms";
import { usePreviousDistinct } from "react-use";

export function RouteChangeListener() {
  const pathname = usePathname();
  const prevPathname = usePreviousDistinct(pathname);
  const setIsFeedbackFormOpenAtom = useSetAtom(isFeedbackFormOpenAtom);
  const setPreviousPathnameAtom = useSetAtom(previousPathnameAtom);

  useEffect(() => {
    if (!prevPathname && pathname) {
      setIsFeedbackFormOpenAtom(true);
    }

    if (pathname && prevPathname && pathname !== prevPathname) {
      setIsFeedbackFormOpenAtom(false);
    }

    setPreviousPathnameAtom(prevPathname);
  }, [
    pathname,
    prevPathname,
    setIsFeedbackFormOpenAtom,
    setPreviousPathnameAtom,
  ]);

  return null;
}
