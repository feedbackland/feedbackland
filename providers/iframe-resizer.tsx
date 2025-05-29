"use client";

// import "@iframe-resizer/child";
// import "@open-iframe-resizer/core";
// import Script from "next/script";
// import dynamic from "next/dynamic";

// const IframeResizerChild = dynamic(() => import("./iframe-resizer-child"), {
//   ssr: false,
// });

export function IframeResizerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* <IframeResizerChild /> */}

      {/* <Script
        src="https://cdn.jsdelivr.net/npm/@open-iframe-resizer/core@latest/dist/index.js"
        strategy="lazyOnload" // Or another appropriate strategy
        onLoad={() => {
          console.log("Module-like script loaded!");
          // Access global variables exposed by the script if any
        }}
      /> */}

      {children}
    </>
  );
}
