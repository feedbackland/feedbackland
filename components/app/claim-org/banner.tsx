"use client";

import { useState } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";

const triggerConfetti = () => {
  confetti({
    particleCount: 100,
    spread: 700,
    origin: { y: 0.1 },
    scalar: 1.2,
    ticks: 150,
  });
};

export function ClaimOrgBanner() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hideBanner, setHideBanner] = useState(false);
  const router = useRouter();
  const { signOut, session } = useAuth();
  const org = useOrg();
  const orgId = org?.id;
  const isOrgClaimed = org?.isClaimed;
  const isSignedIn = !!session;

  console.log("org", org);

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
    setHideBanner(true);
    router.refresh();
    triggerConfetti();
  };

  return (
    <>
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
            hideBanner && "hidden",
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
    </>
  );
}
