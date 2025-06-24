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

export function ClaimOrgBanner({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
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
            "border-primary bg-background flex items-center justify-center rounded-lg border-1 p-3",
            hideBanner && "hidden",
            className,
          )}
        >
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="size-4! shrink-0! basis-4! text-yellow-500" />
              <span className="text-primary text-sm">
                This platform is unclaimed. Claim ownership to make it yours.
              </span>
            </div>
            <Button
              onClick={handleOpenDialog}
              variant="default"
              className=""
              size="sm"
            >
              Claim now
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
