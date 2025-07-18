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
import { WidgetDocs } from "@/components/app/widget-docs";

export function ClaimOrgDialog({
  orgId,
  orgSubdomain,
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

  const { refreshSession } = useAuth();

  const [selectedStep, setSelectedStep] = useState<"sign-up-in" | "success">(
    initialSelectedStep,
  );

  const [selectedMethod, setSelectedMethod] = useState<Method>("sign-up");

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

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleOnClose();
      }}
    >
      <DialogContent
        className={cn(
          "flex max-w-[400px]! flex-col",
          selectedStep === "success" && "top-[40px] max-w-[600px]!",
        )}
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
                <span className="mb-8 flex flex-col items-stretch space-y-2 text-center">
                  <span>You're now the owner of this platform!</span>
                  <span>
                    To embed this platform in your app, follow the steps below:
                  </span>
                </span>
              </DialogDescription>
              <WidgetDocs
                orgId={orgId}
                orgSubdomain={orgSubdomain}
                showTitle={false}
              />
            </DialogHeader>
            <div className="flex items-center justify-center gap-2">
              {/* <Button asChild onClick={handleOnClose}>
                  <Link href={`${platformUrl}/admin`}>
                    Go to the Admin Panel
                  </Link>
                </Button> */}
              <Button onClick={handleOnClose} variant="secondary" className="">
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
