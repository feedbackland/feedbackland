"use client";

// import { useEffect } from "react";
// import { usePathname } from "next/navigation";
// import { useSetAtom } from "jotai";
// import {
//   isFeedbackFormOpenAtom,
//   isInIframeAtom,
//   previousPathnameAtom,
// } from "@/lib/atoms";
// import { usePreviousDistinct } from "react-use";

export function GlobalActionsProvider() {
  // const pathname = usePathname();
  // const prevPathname = usePreviousDistinct(pathname);
  // const setIsFeedbackFormOpenAtom = useSetAtom(isFeedbackFormOpenAtom);
  // const setPreviousPathnameAtom = useSetAtom(previousPathnameAtom);
  // const setIsInIframe = useSetAtom(isInIframeAtom);

  // on first visit, open the feedback form by default
  // afterwards close it
  // useEffect(() => {
  //   if (!prevPathname && pathname) {
  //     setIsFeedbackFormOpenAtom(true);
  //   }

  //   if (pathname && prevPathname && pathname !== prevPathname) {
  //     setIsFeedbackFormOpenAtom(false);
  //   }

  //   setPreviousPathnameAtom(prevPathname);
  // }, [
  //   pathname,
  //   prevPathname,
  //   setIsFeedbackFormOpenAtom,
  //   setPreviousPathnameAtom,
  // ]);

  // useEffect(() => {
  //   const isInIframe = window.self !== window.top;
  //   setIsInIframe(isInIframe);
  // }, [setIsInIframe]);

  return null;
}
