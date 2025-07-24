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
import { useAuth } from "@/hooks/use-auth";
import { useAtomValue } from "jotai";
import { isPlatformPreviewAtom } from "@/lib/atoms";
import { useInIframe } from "@/hooks/use-in-iframe";
import Link from "next/link";
import { usePlatformUrl } from "@/hooks/use-platform-url";

export function ClaimOrgDialog({
  open,
  initialSelectedStep,
  onClaimed,
  onClose,
}: {
  orgId: string;
  orgSubdomain: string;
  open: boolean;
  initialSelectedStep: "sign-up-in" | "success";
  onClaimed?: () => void;
  onClose?: () => void;
}) {
  const trpc = useTRPC();

  const platformUrl = usePlatformUrl();

  const { refreshSession } = useAuth();

  const inIframe = useInIframe();

  const [selectedStep, setSelectedStep] = useState<"sign-up-in" | "success">(
    initialSelectedStep,
  );

  const [selectedMethod, setSelectedMethod] = useState<Method>("sign-up");

  const isPlatformPreview = useAtomValue(isPlatformPreviewAtom);

  const claimOrg = useMutation(
    trpc.claimOrg.mutationOptions({
      onSuccess: () => {
        setSelectedStep("success");
        onClaimed?.();
      },
      onSettled: async () => {
        await refreshSession();
      },
    }),
  );

  const handleSignUpInSuccess = async () => {
    claimOrg.mutate();
  };

  const handleOnClose = () => {
    onClose?.();
  };

  const showWidgetLink = !inIframe || isPlatformPreview;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleOnClose();
      }}
    >
      <DialogContent
        className={cn("flex max-w-[420px]! flex-col")}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {selectedStep === "sign-up-in" && (
          <>
            <DialogHeader className="mt-2 mb-3">
              <DialogTitle className="h3 text-center">
                Claim ownership
              </DialogTitle>
              <DialogDescription className="text-primary text-center">
                Sign up to claim ownership of this platform
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
                Congratulations
              </DialogTitle>
              <DialogDescription className="text-primary">
                <span className="flex flex-col items-stretch space-y-2 text-center">
                  <span>You're now the owner of this platform!</span>
                  <span>
                    {showWidgetLink
                      ? `Next step: Embed the widget to collect in-app feedback.`
                      : `Next step: Check out the admin panel.`}
                  </span>
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center gap-2">
              {showWidgetLink ? (
                <Button asChild onClick={handleOnClose}>
                  <Link href={`${platformUrl}/admin/widget`}>
                    Embed the widget
                  </Link>
                </Button>
              ) : (
                <Button asChild onClick={handleOnClose}>
                  <Link href={`${platformUrl}/admin`}>
                    Go to the admin panel
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
