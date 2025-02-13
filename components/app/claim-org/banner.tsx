"use client";

import { useState, useRef } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { ClaimOrgListener } from "@/components/app/claim-org/listener";
import { CreateTypes } from "canvas-confetti";
import { Confetti } from "@/components/ui/confetti";
import { useSession } from "@/lib/hooks/useSession";

export function ClaimOrgBanner({
  orgId,
  userId,
  isOrgClaimed,
}: {
  orgId: string | undefined;
  userId: string | undefined;
  isOrgClaimed: boolean;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const confettiRef = useRef<CreateTypes>(null);

  const session = useSession();
  console.log("session", session);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const triggerConfetti = () => {
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
        onClaimed={triggerConfetti}
      />

      <ClaimOrgDialog
        open={isDialogOpen}
        initialSelectedStep="sign-up-in"
        orgId={orgId}
        onClose={handleCloseDialog}
        onClaimed={triggerConfetti}
      />

      {!isOrgClaimed && (
        <div className="flex items-center justify-center border-b border-border bg-primary px-4 py-2">
          <div className="flex w-full max-w-[700px] items-center justify-between">
            <span className="text-sm text-primary-foreground">
              This is a unclaimed platform. Claim it to make it yours!
            </span>
            <Button onClick={handleOpenDialog} size="default" variant="outline">
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
