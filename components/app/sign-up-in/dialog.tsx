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
import { User } from "firebase/auth";

export function SignUpInDialog({
  open,
  initialSelectedMethod,
  onClose,
  onSuccess,
}: {
  open: boolean;
  initialSelectedMethod: "sign-up" | "sign-in";
  onClose: () => void;
  onSuccess?: (user: User) => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<Method>(
    initialSelectedMethod,
  );

  const handleOnSuccess = (user: User) => {
    onSuccess?.(user);
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
          onSuccess={handleOnSuccess}
          onSelectedMethodChange={(newSelectedMethod) =>
            setSelectedMethod(newSelectedMethod)
          }
        />
      </DialogContent>
    </Dialog>
  );
}
