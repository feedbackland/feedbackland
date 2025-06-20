"use client";

import { useState } from "react";
import { ClaimOrgDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/use-org";
import { useQueryClient } from "@tanstack/react-query";

export function ClaimOrgBanner() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hideBanner, setHideBanner] = useState(false);
  const { signOut, session } = useAuth();
  const {
    query: { data: org },
  } = useOrg();
  const orgId = org?.id;
  const isOrgClaimed = org?.isClaimed;
  const isSignedIn = !!session;

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
    queryClient.invalidateQueries();
    confetti({
      particleCount: 100,
      spread: 700,
      origin: { y: 0.1 },
      scalar: 1.2,
      ticks: 150,
    });
  };

  return (
    <>
      <ClaimOrgDialog
        open={isDialogOpen}
        initialSelectedStep="sign-up-in"
        orgId={orgId || undefined}
        onClose={handleCloseDialog}
        onClaimed={onClaimed}
      />

      {isOrgClaimed === false && (
        <div
          className={cn(
            "border-border bg-primary flex items-center justify-center border-b px-4 py-2",
            hideBanner && "hidden",
          )}
        >
          <div className="flex w-full max-w-[600px] items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-primary-foreground size-4" />
              <span className="text-primary-foreground text-sm">
                This platform is unclaimed. Take ownership of this platform.
              </span>
            </div>
            <Button
              onClick={handleOpenDialog}
              variant="ghost"
              className="border-muted-foreground text-primary-foreground hover:border-primary-foreground hover:text-primary-foreground border bg-transparent hover:bg-transparent"
            >
              Claim this platform
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
