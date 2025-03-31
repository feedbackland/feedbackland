"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Method, SignUpIn } from "@/components/app/sign-up-in";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function ClaimOrgDialog({
  orgId,
  open,
  initialSelectedStep,
  onClaimed,
  onClose,
}: {
  orgId: string | undefined;
  open: boolean;
  initialSelectedStep: "sign-up-in" | "success";
  onClaimed?: () => void;
  onClose?: () => void;
}) {
  const trpc = useTRPC();

  const [selectedStep, setSelectedStep] = useState<"sign-up-in" | "success">(
    initialSelectedStep,
  );

  const [selectedMethod, setSelectedMethod] = useState<Method>("sign-up");

  const claimOrg = useMutation(trpc.claimOrg.mutationOptions());

  const handleSignUpInSuccess = async () => {
    try {
      await claimOrg.mutateAsync();
      setSelectedStep("success");
      onClaimed?.();
    } catch {
      console.log("error claiming org");
    }
  };

  const handleOnClose = () => {
    onClose?.();
  };

  if (orgId) {
    return (
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleOnClose();
        }}
      >
        <DialogContent
          className={cn("flex max-w-[400px] flex-col")}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {selectedStep === "sign-up-in" && (
            <>
              <DialogHeader className="mt-2 mb-3">
                <DialogTitle className="h3 text-center">
                  Claim this platform
                </DialogTitle>
                <DialogDescription className="text-primary text-center">
                  Create an account or sign in to your existing account to claim
                  ownership of this platform
                </DialogDescription>
              </DialogHeader>
              <SignUpIn
                selectedMethod={selectedMethod}
                onSelectedMethodChange={(newSelectedMethod) =>
                  setSelectedMethod(newSelectedMethod)
                }
                onSuccess={handleSignUpInSuccess}
              />
            </>
          )}

          {selectedStep === "success" && (
            <>
              <DialogHeader className="mt-2 mb-3">
                <PartyPopper className="text-primary mx-auto mb-3 size-14" />
                <DialogTitle className="h3 mb-2 text-center">
                  Congratulations!
                </DialogTitle>
                <DialogDescription className="text-primary text-center">
                  You&apos;ve successfully claimed ownership of this platform.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center">
                <Button
                  onClick={handleOnClose}
                  variant="secondary"
                  className="mt-2"
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
