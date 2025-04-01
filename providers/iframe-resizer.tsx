"use client";

import dynamic from "next/dynamic";

const IframeResizerChild = dynamic(() => import("./iframe-resizer-child"), {
  ssr: false,
});

export function IframeResizerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <IframeResizerChild />
      {children}
    </>
  );
}
