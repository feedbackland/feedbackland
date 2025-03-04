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
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "@/components/app/claim-org/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";

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
  const [selectedStep, setSelectedStep] = useState<"sign-up-in" | "success">(
    initialSelectedStep,
  );

  const [selectedMethod, setSelectedMethod] = useState<Method>("sign-up");

  const { execute: claimOrg } = useAction(claimOrgAction, {
    onSuccess: () => {
      handleOnClaimed();
    },
    onError: (error) => {
      console.log("claimOrg error", error);
    },
  });

  const handleSignUpInSuccess = async ({ userId }: { userId: string }) => {
    if (orgId && userId) {
      claimOrg({ orgId, userId });
    }
  };

  const handleOnClaimed = () => {
    setSelectedStep("success");
    onClaimed?.();
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
              <DialogHeader className="mb-3 mt-2">
                <DialogTitle className="h3 text-center">
                  Claim this platform
                </DialogTitle>
                <DialogDescription className="text-center text-primary">
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
              <DialogHeader className="mb-3 mt-2">
                <PartyPopper className="mx-auto mb-3 size-14 text-primary" />
                <DialogTitle className="h3 mb-2 text-center">
                  Congratulations!
                </DialogTitle>
                <DialogDescription className="text-center text-primary">
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
