"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignUpIn } from ".";
import { useState } from "react";
import { Method } from ".";
import { Session } from "@/hooks/use-auth";

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
  const [selectedMethod, setSelectedMethod] = useState<Method>(
    initialSelectedMethod,
  );

  const handleOnSuccess = (session: Session) => {
    onSuccess?.(session);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-[420px]! pb-8">
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
