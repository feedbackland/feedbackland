// import { useLayoutEffect } from "react";

// export const useScrollLock = (isLocked: boolean) => {
//   useLayoutEffect(() => {
//     // Get original body overflow
//     const originalStyle = window.getComputedStyle(document.body).overflow;

//     if (isLocked) {
//       // Prevent scrolling on mount
//       document.body.style.overflow = "hidden";
//     }

//     // Re-enable scrolling when component unmounts
//     return () => {
//       document.body.style.overflow = originalStyle;
//     };
//   }, [isLocked]); // Only re-run effect if isLocked changes
// };

import { useLayoutEffect } from "react";

export const useScrollLock = (isLocked: boolean) => {
  useLayoutEffect(() => {
    if (isLocked) {
      // Get the original body overflow
      const originalOverflow = window.getComputedStyle(document.body).overflow;
      const originalPaddingRight = window.getComputedStyle(
        document.body
      ).paddingRight;

      // Calculate scrollbar width
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      // Apply styles to the body
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      // Cleanup function to restore original styles
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isLocked]); // Re-run effect when isLocked changes
};
