"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSetAtom } from "jotai";
import { previousPathnameAtom } from "@/lib/atoms";
import { usePreviousDistinct } from "react-use";

export function GlobalState() {
  const pathname = usePathname();
  const prevPathname = usePreviousDistinct(pathname);
  const setPreviousPathnameAtom = useSetAtom(previousPathnameAtom);

  useEffect(() => {
    setPreviousPathnameAtom(prevPathname);
  }, [pathname, prevPathname, setPreviousPathnameAtom]);

  return null;
}
