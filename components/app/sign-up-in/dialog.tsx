"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignUpIn } from ".";
import { useState, useEffect, useRef } from "react";
import { Method } from ".";
import { Session } from "@/hooks/use-auth";
import { useInIframe } from "@/hooks/use-in-iframe";

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
  const inIframe = useInIframe();
  const originalBodyHeight = useRef<string | null>(null);
  const originalBodyOverflow = useRef<string | null>(null);

  useEffect(() => {
    if (inIframe === null) return; // Wait for inIframe to be determined

    if (open) {
      // Dialog opens
      originalBodyHeight.current = document.body.style.height;
      originalBodyOverflow.current = document.body.style.overflow;

      // Set height to 100vh and hide overflow if in iframe
      document.body.style.height = "100vh";
      document.body.style.overflow = "hidden";
    } else {
      // Dialog closes
      // Restore original body styles if in iframe
      if (originalBodyHeight.current !== null) {
        document.body.style.height = originalBodyHeight.current;
      }
      if (originalBodyOverflow.current !== null) {
        document.body.style.overflow = originalBodyOverflow.current;
      }
    }

    // Cleanup function to ensure styles are reset if component unmounts while dialog is open
    return () => {
      if (open) {
        if (originalBodyHeight.current !== null) {
          document.body.style.height = originalBodyHeight.current;
        }
        if (originalBodyOverflow.current !== null) {
          document.body.style.overflow = originalBodyOverflow.current;
        }
      }
    };
  }, [open, inIframe]);

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
