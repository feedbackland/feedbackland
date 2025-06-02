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
  // 1) Create a “virtual” element whose rect is always at (vw/2, vh/2):
  const virtualReference = useMemo(
    () => ({
      getBoundingClientRect: () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return {
          width: 0,
          height: 0,
          top: vh / 2,
          bottom: vh / 2,
          left: vw / 2,
          right: vw / 2,
          x: vw / 2,
          y: vh / 2,
        };
      },
    }),
    [],
  );

  // 2) Ask Floating UI for (x, y) with strategy="fixed":
  const { x, y, strategy, refs } = useFloating({
    placement: "bottom-start",
    strategy: "fixed",
  });

  // 3) Tell Floating UI to use our virtual reference
  useLayoutEffect(() => {
    refs.setReference(virtualReference);
  }, [refs, virtualReference]);

  if (!open) {
    return null;
  }

  // 4) Render your floating element at (x, y). Because virtualReference is at the viewport center,
  //    Floating UI will place the element’s top-left at exactly (vw/2, vh/2). If you want true centering,
  //    add “transform: translate(-50%, -50%)” below.
  return (
    <div
      ref={refs.setFloating}
      style={{
        position: strategy,
        top: y ?? 0,
        left: x ?? 0,
        transform: "translate(-50%, -50%)",
        padding: "1rem",
        background: "#0066CC",
        color: "white",
        borderRadius: "4px",
      }}
    >
      I stay centered!
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
