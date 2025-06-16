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
import { useSubdomain } from "@/hooks/use-subdomain";

export const GlobalOrgState = memo(() => {
  const pathname = usePathname();
  const prevPathname = usePreviousDistinct(pathname);
  const setPreviousPathnameAtom = useSetAtom(previousPathnameAtom);
  const setActivityFeedState = useSetAtom(activtyFeedStateAtom);
  const setFeedbackPostsState = useSetAtom(feedbackPostsStateAtom);
  const setExpandedInsightsAtom = useSetAtom(expandedInsightsAtom);
  const subdomain = useSubdomain();

  useEffect(() => {
    const prevPage = prevPathname?.split("/")?.pop()?.replace(subdomain, "");
    const nextPage = pathname
      ?.split("/")
      ?.pop()
      ?.replace(subdomain, "") as string;

    setPreviousPathnameAtom(prevPathname);

    if (prevPage === "activity" && !isUuidV4(nextPage)) {
      setActivityFeedState(RESET);
    }

    if (prevPage === "insights" && !isUuidV4(nextPage)) {
      setExpandedInsightsAtom(RESET);
    }

    if (prevPage === "" && !isUuidV4(nextPage)) {
      setFeedbackPostsState(RESET);
    }
  }, [
    pathname,
    prevPathname,
    subdomain,
    setPreviousPathnameAtom,
    setActivityFeedState,
    setFeedbackPostsState,
    setExpandedInsightsAtom,
  ]);

  return null;
});

GlobalOrgState.displayName = "GlobalOrgState";
