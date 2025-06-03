"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignUpIn } from ".";
import { useEffect, useState } from "react";
import { Method } from ".";
import { Session } from "@/hooks/use-auth";
import { useAtomValue } from "jotai";
import { iframeParentRefAtom } from "@/lib/atoms";
import { useInIframe } from "@/hooks/use-in-iframe";
import { cn } from "@/lib/utils";

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
  // const inIframe = useInIframe();
  const iframeParentRef = useAtomValue(iframeParentRefAtom);
  const [scrollY, setScrollY] = useState<number | null>(null);

  const [selectedMethod, setSelectedMethod] = useState<Method>(
    initialSelectedMethod,
  );

  const handleOnSuccess = (session: Session) => {
    onSuccess?.(session);
    onClose();
  };

  useEffect(() => {
    if (open && iframeParentRef) {
      iframeParentRef.getScrollY().then((scrollY) => {
        setScrollY(Math.round(scrollY));
      });
    } else {
      setScrollY(null);
    }
  }, [open, iframeParentRef]);

  if (scrollY !== null) {
    return (
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onClose();
          }
        }}
      >
        <DialogContent
          // className={cn("max-w-[420px]! pb-8")}
          className="!fixed !left-1/2 w-full max-w-lg !-translate-x-1/2"
          // Inline style to set dynamic top position:
          style={{ top: `${scrollY + 300}px` }}
        >
          <DialogHeader>
            <DialogTitle className="h3 mb-5 text-center">
              {selectedMethod === "sign-in" && "Sign in"}
              {selectedMethod === "sign-up" && "Sign up"}
              {selectedMethod === "forgot-password" && "Forgot password"}
            </DialogTitle>
          </DialogHeader>
          <SignUpIn
            selectedMethod={selectedMethod}
            onSuccess={handleOnSuccess}
            onSelectedMethodChange={(newSelectedMethod) =>
              setSelectedMethod(newSelectedMethod)
            }
          />
        </DialogContent>
      </Dialog>
    );
  }
}
