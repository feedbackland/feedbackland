"use client";

import { useState, useRef } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { ClaimOrgListener } from "@/components/app/claim-org/listener";
import { CreateTypes } from "canvas-confetti";
import { Confetti } from "@/components/ui/confetti";
import { signOut } from "@/lib/client/auth-client";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export function ClaimOrgBanner({
  orgId,
  userId,
  isOrgClaimed,
  isSignedIn,
}: {
  orgId: string | undefined;
  userId: string | undefined;
  isOrgClaimed: boolean;
  isSignedIn: boolean;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClaimedClientSide, setIsClaimedClientSide] = useState(false);

  const confettiRef = useRef<CreateTypes>(null);

  const handleOpenDialog = async () => {
    setIsDialogOpen(true);

    if (isSignedIn) {
      await signOut();
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const onClaimed = () => {
    setIsClaimedClientSide(true);
    setTimeout(() => {
      confettiRef.current?.({
        particleCount: 100,
        spread: 700,
        origin: { y: 0.3 },
      });
    }, 500);
  };

  return (
    <>
      <ClaimOrgListener
        orgId={orgId}
        userId={userId}
        isOrgClaimed={isOrgClaimed}
        onClaimed={onClaimed}
      />

      <ClaimOrgDialog
        open={isDialogOpen}
        initialSelectedStep="sign-up-in"
        orgId={orgId}
        onClose={handleCloseDialog}
        onClaimed={onClaimed}
      />

      {!isOrgClaimed && (
        <div
          className={cn(
            "flex items-center justify-center border-b border-border bg-primary px-4 py-2",
            isClaimedClientSide && "hidden",
          )}
        >
          <div className="flex w-full max-w-[700px] items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-primary-foreground" />
              <span className="text-sm text-primary-foreground">
                This platform is unclaimed. Take ownership of this platform.
              </span>
            </div>
            <Button
              onClick={handleOpenDialog}
              variant="ghost"
              className="border border-muted-foreground bg-transparent text-primary-foreground hover:border-primary-foreground hover:bg-transparent hover:text-primary-foreground"
            >
              Claim this platform
            </Button>
          </div>
        </div>
      )}

      <Confetti
        onInit={({ confetti }: { confetti: CreateTypes }) => {
          confettiRef.current = confetti;
        }}
      />
    </>
  );
}
