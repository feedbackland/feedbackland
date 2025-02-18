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

export function SignUpInDialog({
  open,
  initialSelectedMethod,
  refreshOnSuccess = true,
  onClose,
  onSuccess,
}: {
  open: boolean;
  initialSelectedMethod: "sign-up" | "sign-in";
  refreshOnSuccess?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<Method>(
    initialSelectedMethod,
  );

  const handleOnSuccess = () => {
    onSuccess?.();
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
      <DialogContent className="max-w-[400px] pb-8">
        <DialogHeader>
          <DialogTitle className="h3 mb-5 text-center">
            {selectedMethod === "sign-in" && "Sign in"}
            {selectedMethod === "sign-up" && "Sign up"}
            {selectedMethod === "forgot-password" && "Forgot password"}
          </DialogTitle>
        </DialogHeader>
        <SignUpIn
          selectedMethod={selectedMethod}
          refreshOnSuccess={refreshOnSuccess}
          onSuccess={handleOnSuccess}
          onSelectedMethodChange={(newSelectedMethod) =>
            setSelectedMethod(newSelectedMethod)
          }
        />
      </DialogContent>
    </Dialog>
  );
}
