"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignUpIn } from ".";
import { useLayoutEffect, useMemo, useState } from "react";
import { Method } from ".";
import { Session } from "@/hooks/use-auth";
import { useFloating, shift, autoUpdate } from "@floating-ui/react";

export function SignUpInDialog({
  open,
  initialSelectedMethod,
  onClose,
  onSuccess,
}: {
  open: boolean;
  initialSelectedMethod: "sign-up" | "sign-in";
  onClose: () => void;
  onSuccess?: (session: Session) => void;
}) {
  // 1) Virtual reference now reads from `window.parent.*` instead of `window.*`.
  //    That way, Floating UI thinks our “anchor point” is at the center of the parent viewport.
  const virtualReference = useMemo(
    () => ({
      getBoundingClientRect: () => {
        // If the iframe is same‐origin with the parent, this will work:
        const parentWidth = window.parent.innerWidth;
        const parentHeight = window.parent.innerHeight;

        return {
          width: 0,
          height: 0,
          top: parentHeight / 2,
          bottom: parentHeight / 2,
          left: parentWidth / 2,
          right: parentWidth / 2,
          x: parentWidth / 2,
          y: parentHeight / 2,
        };
      },
    }),
    [],
  );

  // 2) Still use strategy='fixed', but note: fixed inside the iframe still keeps your element
  //    “fixed relative to the iframe window.” We need a small trick: after computing
  //    (x, y) as if we were in the parent, we also need to offset by the parent’s scroll position
  //    and the iframe’s offset on the page.
  //
  //    Here’s the breakdown:
  //      - parentScrollY = how far the parent document is scrolled vertically.
  //      - parentScrollX = how far it’s scrolled horizontally.
  //      - iframeRect = the iframe’s top/left coordinates relative to the parent document.
  //
  //    Final top-for-iframe = (parentHeight/2 + parentScrollY) – iframeRect.top
  //    Final left-for-iframe = (parentWidth/2 + parentScrollX) – iframeRect.left
  //
  //    But Floating UI only returns a raw (x, y) based on our virtual reference—so we’ll manually
  //    subtract out the iframe’s position.
  //
  const {
    x: rawX,
    y: rawY,
    strategy,
    refs,
  } = useFloating({
    placement: "bottom-start",
    strategy: "fixed",
  });

  useLayoutEffect(() => {
    refs.setReference(virtualReference);
  }, [refs, virtualReference]);

  // 3) We need to correct Floating UI’s (x, y) so that, when viewed inside the iframe,
  //    the element really ends up at the parent-window’s center. The formula is:
  //
  //    displayedX = rawX - iframeRect.left - parentScrollX
  //    displayedY = rawY - iframeRect.top  - parentScrollY
  //
  // To get iframeRect, we call getBoundingClientRect() on the <iframe> element
  // from within the iframe’s own code. That’s a little weird—since the iframe’s JS
  // can’t directly do `document.querySelector('iframe')`. But you can pass the iframe’s
  // ID or name into the iframe, or store it globally on window. For simplicity, assume
  // the parent assigned an `id="myReactIframe"` on the <iframe> tag.
  //
  // In a real setup, you’d do something like:
  //
  //    <iframe id="myReactIframe" src="https://your‐app‐url" … />
  //
  // And inside the React code (running in that iframe) you can do:
  //    const iframeEl = window.parent.document.getElementById('myReactIframe');
  //    const { top: iframeTop, left: iframeLeft } = iframeEl.getBoundingClientRect();
  //    const parentScrollY = window.parent.scrollY;
  //    const parentScrollX = window.parent.scrollX;
  //
  // Putting it all together:
  const [displayX, displayY] = (() => {
    if (rawX == null || rawY == null) return [0, 0];

    // 3a) Grab the <iframe> element in the parent DOM
    const iframeEl = window.parent.document.getElementById("myReactIframe");
    if (!iframeEl) return [rawX, rawY];

    const { top: iframeTop, left: iframeLeft } =
      iframeEl.getBoundingClientRect();
    const parentScrollY = window.parent.scrollY;
    const parentScrollX = window.parent.scrollX;

    // 3b) Compute final coordinates inside the iframe’s coordinate system
    const adjustedX = rawX - iframeLeft - parentScrollX;
    const adjustedY = rawY - iframeTop - parentScrollY;
    return [adjustedX, adjustedY];
  })();

  if (!open) {
    return null;
  }

  return (
    <div
      ref={refs.setFloating}
      style={{
        position: strategy,
        top: displayY,
        left: displayX,
        transform: "translate(-50%, -50%)",
        padding: "1rem",
        background: "#CC5500",
        color: "white",
        borderRadius: "4px",
        pointerEvents: "auto", // or none, depending on whether you want clicks to register
      }}
    >
      I float at the parent's center
    </div>
  );
  // const [selectedMethod, setSelectedMethod] = useState<Method>(
  //   initialSelectedMethod,
  // );

  // const handleOnSuccess = (session: Session) => {
  //   onSuccess?.(session);
  //   onClose();
  // };

  // return (
  //   <Dialog
  //     open={open}
  //     onOpenChange={(isOpen) => {
  //       if (!isOpen) {
  //         onClose();
  //       }
  //     }}
  //   >
  //     <DialogContent className="max-w-[420px]! pb-8">
  //       <DialogHeader>
  //         <DialogTitle className="h3 mb-5 text-center">
  //           {selectedMethod === "sign-in" && "Sign in"}
  //           {selectedMethod === "sign-up" && "Sign up"}
  //           {selectedMethod === "forgot-password" && "Forgot password"}
  //         </DialogTitle>
  //       </DialogHeader>
  //       <SignUpIn
  //         selectedMethod={selectedMethod}
  //         onSuccess={handleOnSuccess}
  //         onSelectedMethodChange={(newSelectedMethod) =>
  //           setSelectedMethod(newSelectedMethod)
  //         }
  //       />
  //     </DialogContent>
  //   </Dialog>
  // );
}
