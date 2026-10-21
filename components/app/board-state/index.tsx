"use client";

import { memo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSetAtom } from "jotai";
import {
  previousPathnameAtom,
  activtyFeedStateAtom,
  feedbackPostsStateAtom,
  expandedInsightsAtom,
} from "@/lib/atoms";
import { usePreviousDistinct } from "react-use";
import { isUuidV4 } from "@/lib/utils";
import { RESET } from "jotai/utils";

export const BoardState = memo(() => {
  const pathname = usePathname();
  const prevPathname = usePreviousDistinct(pathname);
  const setPreviousPathnameAtom = useSetAtom(previousPathnameAtom);
  const setActivityFeedState = useSetAtom(activtyFeedStateAtom);
  const setFeedbackPostsState = useSetAtom(feedbackPostsStateAtom);
  const setExpandedInsights = useSetAtom(expandedInsightsAtom);

  useEffect(() => {
    const prevPage = prevPathname?.split("/").pop();
    const nextPage = pathname?.split("/").pop() ?? "";

    setPreviousPathnameAtom(prevPathname);

    if (prevPage === "activity" && !isUuidV4(nextPage)) {
      setActivityFeedState(RESET);
    }

    if (prevPage === "insights" && !isUuidV4(nextPage)) {
      setExpandedInsights(RESET);
    }

    if (prevPage === "" && !isUuidV4(nextPage)) {
      setFeedbackPostsState(RESET);
    }
  }, [
    pathname,
    prevPathname,
    setPreviousPathnameAtom,
    setActivityFeedState,
    setFeedbackPostsState,
    setExpandedInsights,
  ]);

  return null;
});

BoardState.displayName = "BoardState";
