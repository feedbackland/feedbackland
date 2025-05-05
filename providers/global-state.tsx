"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSetAtom } from "jotai";
import { previousPathnameAtom, activtyFeedStateAtom } from "@/lib/atoms";
import { usePreviousDistinct } from "react-use";
import { isUuidV4 } from "@/lib/utils";
import { RESET } from "jotai/utils";

export function GlobalState() {
  const pathname = usePathname();
  const prevPathname = usePreviousDistinct(pathname);
  const setPreviousPathnameAtom = useSetAtom(previousPathnameAtom);
  const setActivityFeedState = useSetAtom(activtyFeedStateAtom);

  useEffect(() => {
    const prevLastSegment = prevPathname?.split("/").pop();
    const lastSegment = pathname?.split("/").pop();

    setPreviousPathnameAtom(prevPathname);

    if (lastSegment && !isUuidV4(lastSegment) && prevLastSegment === "admin") {
      setActivityFeedState(RESET);
    }
  }, [pathname, prevPathname, setPreviousPathnameAtom, setActivityFeedState]);

  return null;
}
