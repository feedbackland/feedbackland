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
  const dialogOffsetY = 300;

  const iframeParentRef = useAtomValue(iframeParentRefAtom);

  const [scrollY, setScrollY] = useState(dialogOffsetY);
  const [selectedMethod, setSelectedMethod] = useState<Method>(
    initialSelectedMethod,
  );

  const handleOnSuccess = (session: Session) => {
    onSuccess?.(session);
    onClose();
  };

  useEffect(() => {
    const setDialogPosition = async () => {
      const scrollY = await (iframeParentRef?.getScrollY() || 0);
      setScrollY(Math.round(scrollY + dialogOffsetY));
    };

    if (open && iframeParentRef) {
      setDialogPosition();
    }
  }, [open, iframeParentRef]);

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
        className="max-w-[420px]! duration-0!"
        style={{ top: `${scrollY}px` }}
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
