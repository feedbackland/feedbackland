"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignUpIn } from ".";
import { useState } from "react";

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
  onClose?: () => void;
  onSuccess?: () => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<"sign-up" | "sign-in">(
    initialSelectedMethod,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose?.();
      }}
    >
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {selectedMethod === "sign-in" ? "Sign in" : "Sign up"}
          </DialogTitle>
        </DialogHeader>
        <SignUpIn
          initialSelectedMethod={selectedMethod}
          refreshOnSuccess={refreshOnSuccess}
          onSuccess={() => onSuccess?.()}
          onSelectedMethodChange={(newSelectedMethod) =>
            setSelectedMethod(newSelectedMethod)
          }
        />
      </DialogContent>
    </Dialog>
  );
}
