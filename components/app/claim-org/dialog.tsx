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
import { cn, triggers } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  const router = useRouter();

  const [selectedStep, setSelectedStep] = useState<"sign-up-in" | "success">(
    initialSelectedStep,
  );

  const { execute: claimOrg } = useAction(claimOrgAction, {
    onSuccess: () => {
      setSelectedStep("success");
      onClaimed?.();
    },
  });

  const handleSignUpInSuccess = async ({ userId }: { userId: string }) => {
    if (orgId) claimOrg({ orgId, userId });
  };

  const handleOnClose = () => {
    router.refresh();
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
            "flex max-w-[400px] flex-col",
            selectedStep === "success" && "max-w-[650px]",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
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
                context={triggers.claimOrg}
                selectedMethod="sign-up"
                onSuccess={handleSignUpInSuccess}
              />
            </>
          )}

          {selectedStep === "success" && (
            <>
              <DialogHeader className="mb-3 mt-2">
                <DialogTitle className="h3 mb-2 text-center">
                  Congratulations!
                </DialogTitle>
                <DialogDescription className="flex flex-col space-y-1 text-center text-sm">
                  <span className="text-primary">
                    You&apos;ve successfully claimed ownership of this platform.
                  </span>
                  <span className="text-primary">
                    Want to embed your platform in your app? Install the widget!
                  </span>
                </DialogDescription>
              </DialogHeader>
              <WidgetDocsContent orgId={orgId} />
              <div className="flex justify-end">
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
