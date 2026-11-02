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
import { type Session, useAuth } from "@/hooks/use-auth";

export function SignUpInDialog({
  open,
  initialSelectedMethod,
  includeAnonymous = false,
  onClose,
  onSuccess,
}: {
  open: boolean;
  initialSelectedMethod: "sign-up" | "sign-in";
  includeAnonymous?: boolean;
  onClose: () => void;
  onSuccess?: (session: Session | null) => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<Method>(
    initialSelectedMethod,
  );
  const { isLoaded } = useAuth();
  if (!isLoaded) return null;

  const close = () => {
    setSelectedMethod(initialSelectedMethod);
    onClose();
  };
  const handleOnSuccess = (session: Session | null) => {
    onSuccess?.(session);
    close();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          close();
        }
      }}
    >
      <DialogContent className="max-w-[420px]!">
        <DialogHeader>
          <DialogTitle className="h3 mb-5 text-center">
            {selectedMethod === "sign-in" && "Sign in"}
            {selectedMethod === "sign-up" && "Sign up"}
            {selectedMethod === "forgot-password" && "Forgot password"}
          </DialogTitle>
        </DialogHeader>
        <SignUpIn
          selectedMethod={selectedMethod}
          includeAnonymous={includeAnonymous}
          onSuccess={handleOnSuccess}
          onSelectedMethodChange={(newSelectedMethod) =>
            setSelectedMethod(newSelectedMethod)
          }
        />
      </DialogContent>
    </Dialog>
  );
}
