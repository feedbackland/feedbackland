"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SignUpIn } from "@/components/app/sign-up-in";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { claimOrgAction } from "@/components/app/claim-org/actions";
import { WidgetDocsContent } from "../widget-docs/content";
import { cn } from "@/lib/utils";

export function ClaimOrgDialog({
  orgId,
  open,
  initialSelectedStep,
  onClose,
}: {
  orgId: string | undefined;
  open: boolean;
  initialSelectedStep: "sign-up-in" | "success";
  onClose?: () => void;
}) {
  const [selectedStep, setSelectedStep] = useState<"sign-up-in" | "success">(
    initialSelectedStep,
  );

  const { execute: claimOrg } = useAction(claimOrgAction, {
    onSuccess: () => {
      setSelectedStep("success");
    },
  });

  const handleSignUpInSuccess = async ({ userId }: { userId: string }) => {
    if (orgId) claimOrg({ orgId, userId });
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
          className={cn(
            "w-full max-w-[425px]",
            selectedStep === "success" && "max-w-[600px]",
          )}
        >
          {selectedStep === "sign-up-in" && (
            <>
              <DialogHeader className="mb-3 mt-2">
                <DialogTitle className="h3 text-center">
                  Claim this platform
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Sign up or in to claim ownership of this platform
                </DialogDescription>
              </DialogHeader>
              <SignUpIn
                context="claim-org"
                initialSelectedMethod="sign-up"
                onSuccess={handleSignUpInSuccess}
              />
            </>
          )}

          {selectedStep === "success" && (
            <>
              <DialogHeader className="mb-3 mt-2">
                <DialogTitle className="h3 mb-1 text-center">
                  Congratulations!
                </DialogTitle>
                <DialogDescription className="flex flex-col space-y-1 text-center text-sm text-primary">
                  <span>You&apos;re now the owner of this platform.</span>
                  <span>
                    Next step: install the widget to start collecting feedback
                    in your app.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <WidgetDocsContent orgId={orgId} />
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
